import { readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { parseArgs } from 'node:util';
import { DatabaseSync } from 'node:sqlite';
import { importWorkbenchModule } from '../lib/workbench.mjs';
import {
  extensionPluginRoot,
  extensionSkillRoot,
} from '../lib/resource-sources.mjs';

const { loadSkillDefinition, readSkillFiles } = await importWorkbenchModule(
  'packages/resource-loader/src/skill.ts',
);
const { parsePluginManifest } = await importWorkbenchModule(
  'packages/resource-loader/src/plugin.ts',
);
const {
  createPluginDistribution,
  createSkillDistribution,
  parseDistribution,
  reidentifyDistribution,
  sha256,
  packageId,
} = await importWorkbenchModule('packages/resource-loader/src/distribution.ts');
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
      kind: { type: 'string' },
      plugin: { type: 'string' },
      skill: { type: 'string' },
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
      'publish-only': { type: 'boolean' },
      'allow-http': { type: 'boolean' },
      help: { type: 'boolean' },
    },
  });

  if (args.help) {
    console.log(`用法:
  pnpm sync:skill --skill <id> [选项]
  pnpm sync:plugin --plugin <id> [选项]

选项:
  --skill <id>         目标技能标识
  --plugin <id>        目标插件标识 (默认: comfyui)
  --data-dir <path>    Workbench 数据目录
  --source-id <id>     Hub 来源 ID (默认自动读取已启用来源)
  --token-file <path>  发布令牌文件路径 (默认自动从本地 secrets 读取)
  --changelog <text>   版本更新说明
  --apply              实际执行发布及所选本机安装 (不加此参数时仅预览)
  --publish-only       仅发布，保留本机当前版本
  --allow-http         允许向公网 HTTP 来源发送凭据
  --help               显示此帮助信息
`);
    return;
  }

  const dataDir = args['data-dir'];
  if (!dataDir || !existsSync(dataDir)) {
    throw new Error(`未找到 Workbench 数据目录: ${dataDir}`);
  }

  const kind = args.kind ?? (args.skill !== undefined ? 'skill' : 'plugin');
  if (kind !== 'plugin' && kind !== 'skill')
    throw new Error('只支持技能和插件');
  if (
    kind === 'skill'
      ? !args.skill || args.plugin !== undefined
      : args.skill !== undefined
  )
    throw new Error('请用 --skill 或 --plugin 指定对应类型的一个资源');
  const id = packageId(
    kind === 'skill' ? args.skill : (args.plugin ?? 'comfyui'),
  );
  const label = kind === 'skill' ? '技能' : '插件';
  const changelog = args.changelog || `Update ${id}`;
  let bytes;
  if (kind === 'skill') {
    const definition = loadSkillDefinition(
      join(extensionSkillRoot, id, 'SKILL.md'),
    );
    if (definition.id !== id) throw new Error('技能源码标识与目录不同');
    bytes = createSkillDistribution(definition, changelog);
  } else {
    const files = readSkillFiles(join(extensionPluginRoot, id));
    const manifestFile = files.find((f) => f.path === 'plugin.yaml');
    if (!manifestFile) throw new Error(`找不到插件清单 ${id}/plugin.yaml`);
    const definition = parsePluginManifest(
      manifestFile.content.toString('utf8'),
    );
    if (definition.id !== id) throw new Error('插件源码标识与目录不同');
    bytes = createPluginDistribution(definition, files, changelog);
  }

  const { manifest: m } = parseDistribution(bytes);
  const archiveSha256 = sha256(bytes);

  report('package-ready', {
    kind,
    id,
    sourceVersion: m.version,
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

    const path = `/packages/${kind}/${id}`;
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

    if (
      currentPublished &&
      currentPublished.publisherId !== principal.publisherId
    )
      throw new Error('正式资源属于其他发布者');
    const isMatch =
      currentPublished &&
      (currentPublished.source?.payloadDigest === m.payloadDigest ||
        parseDistribution(
          reidentifyDistribution(bytes, id, currentPublished.version),
        ).manifest.payloadDigest === currentPublished.payloadDigest);

    if (isMatch) {
      report('hub-already-latest', {
        kind,
        id,
        version: currentPublished.version,
        payloadDigest: currentPublished.payloadDigest,
      });
      publishedDescriptor = currentPublished;
    } else {
      report(args.apply ? 'publishing' : 'would-publish', {
        kind,
        id,
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
        JSON.stringify([path, head.version, head.payloadDigest, archiveSha256]),
      );
      let { uploadId } = await hub('POST', '/uploads', {
        operationKey: `upload-${key}`,
        archiveSha256,
        bytes: bytes.length,
      });
      let upload = await hub('GET', `/uploads/${uploadId}`);
      if (['rejected', 'cleaned', 'failed'].includes(upload.state)) {
        const retry = await hub('POST', '/uploads', {
          operationKey: `upload-${key}-${Date.now()}`,
          archiveSha256,
          bytes: bytes.length,
        });
        uploadId = retry.uploadId;
        upload = await hub('GET', `/uploads/${uploadId}`);
      }
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
            `发布结果未确认：${id}，操作号 ${operationKey}。请核对 Hub 回执`,
          );
        }
      }

      publishedDescriptor = client.verify(trust, envelope);
      if (
        publishedDescriptor.kind !== kind ||
        publishedDescriptor.id !== id ||
        publishedDescriptor.publisherId !== principal.publisherId ||
        publishedDescriptor.source?.payloadDigest !== m.payloadDigest ||
        envelope.status !== 'published'
      )
        throw new Error('正式发布回执与选定资源、发布者或源码摘要不一致');
      report('published', {
        kind,
        id,
        version: publishedDescriptor.version,
        digest: publishedDescriptor.payloadDigest,
        operationKey,
      });
    }
  } finally {
    client.close();
  }

  if (!args.apply || args['publish-only']) return;
  // 4. 更新本机已安装资源（Owner API）
  report('local-updating', {
    kind,
    id,
    targetVersion: publishedDescriptor.version,
  });

  const installInput = {
    kind,
    id,
    version: publishedDescriptor.version,
    sourceId: source.id,
  };

  // 4.1 下载并登记到本机资源库
  const acquired = await owner('POST', '/v2/gallery/acquisitions', {
    ...installInput,
    operationKey: randomUUID(),
  });
  if (acquired.result?.digest !== publishedDescriptor.payloadDigest)
    throw new Error('本机下载的正式包摘要不同');
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
    kind,
    id,
    version: publishedDescriptor.version,
    applied,
  });

  console.log(
    `\n✅ ${label} ${id} 已成功发布到 Hub 并在本地更新至版本 ${publishedDescriptor.version}！`,
  );
}

await main().catch((error) => {
  console.error('\n❌ 同步失败:', error.message);
  process.exitCode = 1;
});
