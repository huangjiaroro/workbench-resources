import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { parseArgs } from 'node:util';
import { DatabaseSync } from 'node:sqlite';
import { importWorkbenchModule } from '../lib/workbench.mjs';
import {
  extensionPluginRoot,
  resourceSourceRoot,
} from '../lib/resource-sources.mjs';

const { readSkillFiles, skillPackageDigest } = await importWorkbenchModule(
  'packages/resource-loader/src/skill.ts',
);
const { parsePluginManifest } = await importWorkbenchModule(
  'packages/resource-loader/src/plugin.ts',
);
const {
  createPluginDistribution,
  parseDistribution,
  reidentifyDistribution,
  sha256,
  packageId,
} = await importWorkbenchModule(
  'packages/resource-loader/src/distribution.ts',
);
const { GalleryClient } = await importWorkbenchModule(
  'apps/daemon/src/application/gallery-client.ts',
);

class RequestError extends Error {
  constructor(label, status, detail) {
    super(`${label} (${status}): ${detail}`);
    this.status = status;
  }
}

function request(base, token) {
  return async (method, path, input) => {
    const zip = Buffer.isBuffer(input);
    for (let attempt = 0; attempt < 8; attempt++) {
      const response = await fetch(base + path, {
        method,
        redirect: 'error',
        signal: AbortSignal.timeout(300_000),
        headers: {
          ...(token ? { authorization: `Bearer ${token}` } : {}),
          'content-type': zip ? 'application/zip' : 'application/json',
        },
        body:
          input === undefined ? undefined : zip ? input : JSON.stringify(input),
      });
      if (response.status === 429 && attempt < 7) {
        await new Promise((r) => setTimeout(r, 3000 * (attempt + 1)));
        continue;
      }
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new RequestError(
          `${method} ${path}`,
          response.status,
          body.error ?? response.statusText,
        );
      }
      return response.json();
    }
  };
}

function ownerRequest(dataDir) {
  const { host, port } = JSON.parse(
    readFileSync(join(dataDir, 'daemon-endpoint.json'), 'utf8'),
  );
  if (
    host !== '127.0.0.1' ||
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65535
  )
    throw new Error('Workbench 地址必须是有效的本机回环端口');
  return request(
    `http://${host}:${port}`,
    readFileSync(join(dataDir, 'daemon-token'), 'utf8').trim(),
  );
}

const report = (event, details) =>
  console.log(JSON.stringify({ event, ...details }, null, 2));

async function main() {
  const { values: args } = parseArgs({
    options: {
      plugin: { type: 'string', default: 'comfyui' },
      'data-dir': {
        type: 'string',
        default:
          process.env.WORKBENCH_DATA_DIR ||
          join(
            process.env.HOME || '',
            'Library/Application Support/com.zeropoint.workbench',
          ),
      },
      'source-id': { type: 'string' },
      'token-file': { type: 'string' },
      changelog: { type: 'string' },
      apply: { type: 'boolean' },
      'allow-http': { type: 'boolean' },
      help: { type: 'boolean' },
    },
  });

  if (args.help) {
    console.log(`用法:
  node scripts/package/sync-plugin.mjs [选项]

选项:
  --plugin <id>        目标插件标识 (默认: comfyui)
  --data-dir <path>    Workbench 数据目录
  --source-id <id>     Hub 来源 ID (默认自动读取已启用来源)
  --token-file <path>  发布令牌文件路径 (默认自动从本地 secrets 读取)
  --changelog <text>   版本更新说明
  --apply              实际执行提交与本地更新 (不加此参数时仅预览)
  --allow-http         允许向公网 HTTP 来源发送凭据
  --help               显示此帮助信息
`);
    return;
  }

  const dataDir = args['data-dir'];
  if (!dataDir || !existsSync(dataDir)) {
    throw new Error(`未找到 Workbench 数据目录: ${dataDir}`);
  }

  const pluginId = args.plugin;
  packageId(pluginId);
  const pluginDir = join(extensionPluginRoot, pluginId);
  if (!existsSync(join(pluginDir, 'plugin.yaml'))) {
    throw new Error(`未在插件源码目录中找到 plugin.yaml: ${pluginDir}`);
  }

  // 1. 读取本地插件定义与打包
  const pluginFiles = readSkillFiles(pluginDir);
  const manifestFile = pluginFiles.find((f) => f.path === 'plugin.yaml');
  const definition = parsePluginManifest(manifestFile.content.toString('utf8'));
  const changelog =
    args.changelog || `Update ${definition.name || pluginId} plugin`;
  const bytes = createPluginDistribution(definition, pluginFiles, changelog);
  const { manifest: m } = parseDistribution(bytes);
  const archiveSha256 = sha256(bytes);

  report('package-ready', {
    plugin: pluginId,
    sourceVersion: definition.version,
    payloadDigest: m.payloadDigest,
    archiveSha256,
    bytes: bytes.length,
  });

  // 2. 连接本地 Daemon 并读取源信息
  const owner = ownerRequest(dataDir);
  const { sources } = await owner('GET', '/v2/gallery/sources');
  const enabledSources = sources.filter((s) => s.enabled);
  const source = args['source-id']
    ? enabledSources.find((s) => s.id === args['source-id'])
    : enabledSources[0];

  if (!source) {
    throw new Error('未找到已启用的 Workbench Hub 来源');
  }

  const url = new URL(source.url);
  if (
    url.protocol === 'http:' &&
    !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) &&
    !args['allow-http']
  ) {
    throw new Error(
      '向公网 HTTP 来源发送令牌需要添加 --allow-http 参数（允许明文传输）',
    );
  }

  // 读取发布凭据
  let token;
  if (args['token-file']) {
    token = readFileSync(resolve(args['token-file']), 'utf8').trim();
  } else {
    const db = new DatabaseSync(join(dataDir, 'workbench.sqlite'), {
      readOnly: true,
    });
    const row = db
      .prepare('SELECT secret_ref FROM gallery_sources WHERE id=?')
      .get(source.id);
    db.close();
    if (!row || !row.secret_ref) {
      throw new Error('本地数据库中未找到来源凭据引用，请指定 --token-file');
    }
    const secretPath = join(dataDir, 'secrets', row.secret_ref);
    if (!existsSync(secretPath)) {
      throw new Error(`未找到凭据文件: ${secretPath}，请指定 --token-file`);
    }
    token = readFileSync(secretPath, 'utf8').trim();
  }

  // 3. 校验 Hub 与发布者身份
  const client = new GalleryClient(undefined, dataDir);
  let publishedDescriptor;
  try {
    const info = await client.probe({
      url: source.url,
      allowHttp: url.protocol === 'http:',
    });
    if (info.registryId !== source.registryId || info.keyId !== source.keyId) {
      throw new Error('Hub 身份或签名公钥与本地信任记录不一致');
    }
    const trust = { ...source, publicKey: info.publicKey };

    const hub = request(info.url + '/api/gallery/v1', token);
    const principal = await hub('GET', '/identity');
    if (
      !['read', 'upload', 'publish'].every((scope) =>
        principal.scopes.includes(scope),
      )
    ) {
      throw new Error('发布令牌缺少必要的 read/upload/publish 权限');
    }

    const path = `/packages/plugin/${pluginId}`;
    const head = await hub('GET', `${path}/head`);
    let currentPublished;
    if (head.version) {
      const envelope = await hub('GET', `${path}/versions/${head.version}`);
      currentPublished = client.verify(trust, envelope);
    }

    report('hub-baseline', {
      hubUrl: source.url,
      publisherId: principal.publisherId,
      headVersion: head.version ?? null,
      headDigest: head.payloadDigest ?? null,
    });

    const isMatch =
      currentPublished &&
      (currentPublished.source?.payloadDigest === m.payloadDigest ||
        currentPublished.payloadDigest === m.payloadDigest);

    if (isMatch) {
      report('hub-already-latest', {
        plugin: pluginId,
        version: currentPublished.version,
        payloadDigest: currentPublished.payloadDigest,
      });
      publishedDescriptor = currentPublished;
    } else {
      report(args.apply ? 'publishing' : 'would-publish', {
        plugin: pluginId,
        baseVersion: head.version ?? null,
        sourceDigest: m.payloadDigest,
      });

      if (!args.apply) {
        console.log(
          '\n[预览完成] 存在未发布的更新。若要实际发布到 Hub 并更新本机安装，请添加 --apply 参数再次运行。',
        );
        return;
      }

      // 执行发布流程
      const key = sha256(
        JSON.stringify([
          path,
          head.version,
          head.payloadDigest,
          archiveSha256,
        ]),
      );
      const { uploadId } = await hub('POST', '/uploads', {
        operationKey: `upload-${key}`,
        archiveSha256,
        bytes: bytes.length,
      });
      const upload = await hub('GET', `/uploads/${uploadId}`);
      if (upload.state === 'created') {
        await hub('PUT', `/uploads/${uploadId}/archive`, bytes);
      }
      if (!['ready', 'published'].includes(upload.state)) {
        await hub('POST', `/uploads/${uploadId}/validate`, {});
      }

      const operationKey = `publish-${key}`;
      const input = {
        uploadId,
        archiveSha256,
        payloadDigest: m.payloadDigest,
        baseVersion: head.version ?? null,
        basePayloadDigest: head.payloadDigest ?? null,
        versionPolicy: 'server-assigned',
        operationKey,
      };

      let envelope;
      try {
        envelope = await hub('POST', `${path}/versions`, input);
      } catch (error) {
        if (error instanceof RequestError && error.status < 500) throw error;
        try {
          envelope = (await hub('GET', `/operations/${operationKey}`)).result;
        } catch {
          throw new Error(
            `发布结果未确认：${pluginId}，操作号 ${operationKey}。请核对 Hub 回执`,
          );
        }
      }

      publishedDescriptor = client.verify(trust, envelope);
      report('published', {
        plugin: pluginId,
        version: publishedDescriptor.version,
        digest: publishedDescriptor.payloadDigest,
        operationKey,
      });

      // 同步更新本地源码 plugin.yaml（保持与 Hub 归档及 reidentifyDistribution 格式一致）
      const reidentifiedBytes = reidentifyDistribution(
        bytes,
        pluginId,
        publishedDescriptor.version,
      );
      const reidentifiedPkg = parseDistribution(reidentifiedBytes);
      const reidentifiedYaml = reidentifiedPkg.files.find(
        (f) => f.path === 'plugin.yaml',
      );
      const yamlPath = join(pluginDir, 'plugin.yaml');
      if (reidentifiedYaml) {
        writeFileSync(yamlPath, reidentifiedYaml.content);
      } else {
        const yamlContent = readFileSync(yamlPath, 'utf8');
        const updatedYaml = yamlContent.replace(
          /^version:\s*.*$/m,
          `version: ${publishedDescriptor.version}`,
        );
        writeFileSync(yamlPath, updatedYaml, 'utf8');
      }
      report('source-updated', {
        yamlPath,
        newVersion: publishedDescriptor.version,
      });
    }
  } finally {
    client.close();
  }

  // 4. 更新本机已安装插件（Owner API）
  report('local-updating', {
    plugin: pluginId,
    targetVersion: publishedDescriptor.version,
  });

  const installInput = {
    kind: 'plugin',
    id: pluginId,
    version: publishedDescriptor.version,
    sourceId: source.id,
  };

  // 4.1 下载并登记到本机资源库
  const acquired = await owner('POST', '/v2/gallery/acquisitions', {
    ...installInput,
    operationKey: randomUUID(),
  });
  report('acquired', {
    version: publishedDescriptor.version,
    result: acquired.result,
  });

  // 4.2 生成安装计划
  const plan = await owner('POST', '/v2/resources/install-plans', installInput);
  report('install-plan-created', {
    planId: plan.planId,
    fingerprint: plan.fingerprint,
    references: plan.references ?? [],
  });

  // 4.3 应用安装计划
  const applied = await owner(
    'POST',
    `/v2/resources/install-plans/${plan.planId}/apply`,
    {
      fingerprint: plan.fingerprint,
    },
  );
  report('install-plan-applied', {
    plugin: pluginId,
    version: publishedDescriptor.version,
    applied,
  });

  console.log(
    `\n✅ 插件 ${pluginId} 已成功发布到 Hub 并在本地更新至版本 ${publishedDescriptor.version}！`,
  );
}

await main().catch((error) => {
  console.error('\n❌ 同步失败:', error.message);
  process.exitCode = 1;
});
