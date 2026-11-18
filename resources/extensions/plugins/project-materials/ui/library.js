(() => {
  const mediaNames = { image: '图片素材', video: '视频与成片', audio: '音乐与音频' };
  const mediaExtensions = {
    png: 'image', jpg: 'image', jpeg: 'image', webp: 'image', gif: 'image', svg: 'image',
    mp4: 'video', webm: 'video', mov: 'video', mkv: 'video',
    mp3: 'audio', wav: 'audio', aac: 'audio', m4a: 'audio', ogg: 'audio', flac: 'audio'
  };
  const directorDocuments = new Map([
    ['director/director-plan.md', {kindId: 'director-plan', displayName: '导演整体方案', order: 10}],
    ['director/performance-plan.md', {kindId: 'performance-plan', displayName: '表演设计', order: 11}],
    ['director/shot-plan.md', {kindId: 'shot-plan', displayName: '镜头规划', order: 12}],
    ['director/bgm-plan.md', {kindId: 'bgm-plan', displayName: '背景音乐规划', order: 13}]
  ]);

  const expansion = new Map(), cached = new Map(), docCache = new Map();
  let data = {}, mode = 'documents', signature = '', query = '', selectedMedia = '', selectedDocument = '', selection = 0, observer;
  let documentViewMode = 'rendered'; // 'rendered' | 'source'

  const make = (tag, className, text) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined && text !== null && text !== '') element.textContent = text;
    return element;
  };
  const size = bytes => bytes < 1024 ? bytes + ' B' : bytes < 1024 * 1024 ? Math.round(bytes / 1024) + ' KB' : (bytes / 1024 / 1024).toFixed(1) + ' MB';
  const getMediaKind = item => {
    if (item.kind && ['image', 'video', 'audio'].includes(item.kind)) return item.kind;
    const ext = ((item.relativePath || item.name || item.id || '').split('.').pop() || '').toLowerCase();
    return mediaExtensions[ext];
  };

  function normalizePath(rawPath) {
    let path = (rawPath || '').replace(/\\/g, '/').trim();
    if (path.startsWith('artifacts/')) path = path.slice('artifacts/'.length);
    if (path.startsWith('./')) path = path.slice(2);
    if (path.startsWith('/')) path = path.slice(1);
    return path;
  }

  function classifyArtifact(item) {
    const cleanPath = normalizePath(item.relativePath || item.name || item.id || '');
    const fileName = cleanPath.split('/').pop() || cleanPath;

    // 作品文档按当前目录分组；未识别文件保留原名，不推断交付状态。
    const epFolderMatch = cleanPath.match(/^episodes\/(EP\d+)\/(.*)$/i);
    if (epFolderMatch) {
      const rawEp = epFolderMatch[1];
      const subPath = epFolderMatch[2];

      const numMatch = rawEp.match(/\d+/);
      const numStr = numMatch ? numMatch[0] : '1';
      const episodeKey = rawEp.toUpperCase().startsWith('EP') ? rawEp.toUpperCase() : ('EP' + numStr.padStart(2, '0'));
      const episodeNum = parseInt(numStr, 10);
      const episodeTitle = '第 ' + numStr + ' 集';

      // 当前短剧产物的阅读分组；正式读写路径由组织产物契约决定。
      // 编剧阶段
      if (/^episode-design\.md$/i.test(subPath)) {
        return {
          sectionId: 'episodes', sectionTitle: '分集制作', isEpisode: true, episode: episodeKey, episodeTitle, episodeNum,
          stageId: 'writing', stageTitle: '编剧', stageOrder: 1, kindId: 'episode-design', displayName: '单集戏剧设计', order: 0,
          shortPath: subPath, cleanPath, item
        };
      }
      if (/^script\.md$/i.test(subPath)) {
        return {
          sectionId: 'episodes', sectionTitle: '分集制作', isEpisode: true, episode: episodeKey, episodeTitle, episodeNum,
          stageId: 'writing', stageTitle: '编剧', stageOrder: 1, kindId: 'episode', displayName: '单集分场正文', order: 1,
          shortPath: subPath, cleanPath, item
        };
      }
      if (/^state\.md$/i.test(subPath)) {
        return {
          sectionId: 'episodes', sectionTitle: '分集制作', isEpisode: true, episode: episodeKey, episodeTitle, episodeNum,
          stageId: 'writing', stageTitle: '编剧', stageOrder: 1, kindId: 'episode-state', displayName: '续作状态', order: 2,
          shortPath: subPath, cleanPath, item
        };
      }

      if (/^director\//i.test(subPath)) {
        const document = directorDocuments.get(subPath.toLowerCase()) ??
          {kindId: 'custom', displayName: fileName, order: 99};
        return {
          sectionId: 'episodes', sectionTitle: '分集制作', isEpisode: true, episode: episodeKey, episodeTitle, episodeNum,
          stageId: 'directing', stageTitle: '导演规划', stageOrder: 2, ...document,
          shortPath: subPath, cleanPath, item
        };
      }
      // 视频制作阶段
      if (/^production\/production\.md$/i.test(subPath)) {
        return {
          sectionId: 'episodes', sectionTitle: '分集制作', isEpisode: true, episode: episodeKey, episodeTitle, episodeNum,
          stageId: 'production', stageTitle: '视频制作', stageOrder: 3, kindId: 'video-production', displayName: '视频制作与采用索引', order: 20,
          shortPath: subPath, cleanPath, item
        };
      }

      // 后期交付阶段
      if (/^post\/assembly\.md$/i.test(subPath)) {
        return {
          sectionId: 'episodes', sectionTitle: '分集制作', isEpisode: true, episode: episodeKey, episodeTitle, episodeNum,
          stageId: 'post', stageTitle: '后期交付', stageOrder: 4, kindId: 'assembly', displayName: '成片制作记录', order: 30,
          shortPath: subPath, cleanPath, item
        };
      }
      // 文件位置只表示制作阶段，不能证明视频已经验收或交付。
      const stage = subPath.startsWith('production/')
        ? {stageId: 'production', stageTitle: '视频制作', stageOrder: 3}
        : subPath.startsWith('post/')
          ? {stageId: 'post', stageTitle: '后期交付', stageOrder: 4}
          : {stageId: 'other', stageTitle: '分集补充', stageOrder: 5};
      return {
        sectionId: 'episodes', sectionTitle: '分集制作', isEpisode: true, episode: episodeKey, episodeTitle, episodeNum,
        ...stage, kindId: 'custom', displayName: fileName, order: 99, shortPath: subPath, cleanPath, item
      };
    }

    // 2. 故事设定
    if (/^story\/brief\.md$/i.test(cleanPath)) {
      return { sectionId: 'story', sectionTitle: '故事设定', displayName: '作品目标', kindId: 'brief', order: 1, shortPath: cleanPath, cleanPath, item };
    }
    if (/^story\/project-design\.md$/i.test(cleanPath)) {
      return { sectionId: 'story', sectionTitle: '故事设定', displayName: '整体故事设计', kindId: 'project-design', order: 2, shortPath: cleanPath, cleanPath, item };
    }
    if (/^story\/blueprint\.md$/i.test(cleanPath)) {
      return { sectionId: 'story', sectionTitle: '故事设定', displayName: '故事蓝图', kindId: 'blueprint', order: 3, shortPath: cleanPath, cleanPath, item };
    }
    if (/^story\/canon\.md$/i.test(cleanPath)) {
      return { sectionId: 'story', sectionTitle: '故事设定', displayName: '锁定事实', kindId: 'canon', order: 4, shortPath: cleanPath, cleanPath, item };
    }
    const unitMatch = cleanPath.match(/^story\/units\/([^/]+)\.md$/i);
    if (unitMatch) {
      return { sectionId: 'story', sectionTitle: '故事设定', displayName: '承重单元 · ' + unitMatch[1], kindId: 'story-unit', order: 10, shortPath: cleanPath, cleanPath, item };
    }

    // 3. 全剧资产
    if (/^assets\/asset-registry\.md$/i.test(cleanPath)) {
      return { sectionId: 'assets', sectionTitle: '全剧资产', displayName: '正式素材登记', kindId: 'asset-registry', order: 1, shortPath: cleanPath, cleanPath, item };
    }
    const musicMatch = cleanPath.match(/^assets\/music\/([^/]+)\/track\.md$/i);
    if (musicMatch) {
      return { sectionId: 'assets', sectionTitle: '全剧资产', displayName: '曲目制作 · ' + musicMatch[1], kindId: 'music-track', order: 10, shortPath: cleanPath, cleanPath, item };
    }
    if (/^assets\//i.test(cleanPath)) {
      return { sectionId: 'assets', sectionTitle: '全剧资产', displayName: fileName, kindId: 'asset-item', order: 20, shortPath: cleanPath, cleanPath, item };
    }

    // 4. 研究资料
    const resMatch = cleanPath.match(/^research\/([^/]+)\.md$/i);
    if (resMatch) {
      return { sectionId: 'research', sectionTitle: '研究资料', displayName: '研究记录 · ' + resMatch[1], kindId: 'research', order: 1, shortPath: cleanPath, cleanPath, item };
    }

    // 5. 审查记录
    const revMatch = cleanPath.match(/^reviews\/([^/]+)\.md$/i);
    if (revMatch) {
      return { sectionId: 'reviews', sectionTitle: '审查记录', displayName: '审查记录 · ' + revMatch[1], kindId: 'review', order: 1, shortPath: cleanPath, cleanPath, item };
    }

    // 6. 其他资料
    return {
      sectionId: 'other', sectionTitle: '其他资料', displayName: fileName, kindId: 'other', order: 99, shortPath: cleanPath, cleanPath, item
    };
  }

  const matches = (item, meta) => {
    if (!query) return true;
    const q = query.toLowerCase();
    const str = `${item.name || ''} ${item.relativePath || ''} ${meta?.displayName || ''} ${meta?.episode || ''} ${meta?.stageTitle || ''} ${meta?.sectionTitle || ''}`.toLowerCase();
    return str.includes(q);
  };

  function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function parseInline(text) {
    let escaped = escapeHtml(text);
    escaped = escaped.replace(/`([^`]+)`/g, '<code>$1</code>');
    escaped = escaped.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    escaped = escaped.replace(/__([^_]+)__/g, '<strong>$1</strong>');
    escaped = escaped.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    return escaped;
  }

  function renderMarkdown(md) {
    const container = document.createElement('div');
    container.className = 'markdown-body';
    const lines = md.replace(/\r\n/g, '\n').split('\n');
    let index = 0;
    const isTableStart = at => at + 1 < lines.length &&
      lines[at].trim().startsWith('|') && lines[at].trim().endsWith('|') &&
      /^\s*\|?\s*:?-+:?\s*\|/.test(lines[at + 1]);

    while (index < lines.length) {
      const line = lines[index];
      const trimmed = line.trim();

      if (!trimmed) { index++; continue; }

      if (trimmed.startsWith('```')) {
        const codeLines = [];
        index++;
        while (index < lines.length && !lines[index].trim().startsWith('```')) {
          codeLines.push(lines[index]);
          index++;
        }
        if (index < lines.length) index++;
        const pre = document.createElement('pre');
        const code = document.createElement('code');
        code.textContent = codeLines.join('\n');
        pre.append(code);
        container.append(pre);
        continue;
      }

      const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
      if (headingMatch) {
        const level = headingMatch[1].length;
        const h = document.createElement('h' + level);
        h.innerHTML = parseInline(headingMatch[2]);
        container.append(h);
        index++;
        continue;
      }

      if (/^(\*{3,}|-{3,}|_{3,})$/.test(trimmed)) {
        container.append(document.createElement('hr'));
        index++;
        continue;
      }

      if (isTableStart(index)) {
        const parseRow = rowStr => rowStr.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());
        const headers = parseRow(trimmed);
        index += 2;
        const rows = [];
        while (index < lines.length && lines[index].trim().startsWith('|') && lines[index].trim().endsWith('|')) {
          rows.push(parseRow(lines[index].trim()));
          index++;
        }
        const table = document.createElement('table');
        const thead = document.createElement('thead');
        const headTr = document.createElement('tr');
        for (const h of headers) {
          const th = document.createElement('th');
          th.innerHTML = parseInline(h);
          headTr.append(th);
        }
        thead.append(headTr);
        table.append(thead);
        const tbody = document.createElement('tbody');
        for (const r of rows) {
          const tr = document.createElement('tr');
          for (let i = 0; i < headers.length; i++) {
            const td = document.createElement('td');
            td.innerHTML = parseInline(r[i] ?? '');
            tr.append(td);
          }
          tbody.append(tr);
        }
        table.append(tbody);
        container.append(table);
        continue;
      }

      if (trimmed.startsWith('>')) {
        const quoteLines = [];
        while (index < lines.length && (lines[index].trim().startsWith('>') || (lines[index].trim() && quoteLines.length))) {
          if (lines[index].trim().startsWith('>')) {
            quoteLines.push(lines[index].trim().replace(/^>\s?/, ''));
          } else {
            quoteLines.push(lines[index].trim());
          }
          index++;
        }
        const bq = document.createElement('blockquote');
        const p = document.createElement('p');
        p.innerHTML = parseInline(quoteLines.join(' '));
        bq.append(p);
        container.append(bq);
        continue;
      }

      if (/^[-*+•]\s+/.test(trimmed)) {
        const ul = document.createElement('ul');
        while (index < lines.length && /^[-*+•]\s+/.test(lines[index].trim())) {
          const itemText = lines[index].trim().replace(/^[-*+•]\s+/, '');
          const li = document.createElement('li');
          li.innerHTML = parseInline(itemText);
          ul.append(li);
          index++;
        }
        container.append(ul);
        continue;
      }

      if (/^\d+\.\s+/.test(trimmed)) {
        const ol = document.createElement('ol');
        while (index < lines.length && /^\d+\.\s+/.test(lines[index].trim())) {
          const itemText = lines[index].trim().replace(/^\d+\.\s+/, '');
          const li = document.createElement('li');
          li.innerHTML = parseInline(itemText);
          ol.append(li);
          index++;
        }
        container.append(ol);
        continue;
      }

      const paraLines = [trimmed];
      index++;
      while (index < lines.length && lines[index].trim() && !lines[index].trim().startsWith('```') && !/^(#{1,6})\s+/.test(lines[index].trim()) && !/^[-*+•]\s+/.test(lines[index].trim()) && !/^\d+\.\s+/.test(lines[index].trim()) && !lines[index].trim().startsWith('>') && !isTableStart(index)) {
        paraLines.push(lines[index].trim());
        index++;
      }
      const p = document.createElement('p');
      p.innerHTML = paraLines.map(parseInline).join('<br>');
      container.append(p);
    }

    return container;
  }

  async function mediaUrl(item, onProgress) {
    const revision = item.updatedAt || item.mediaRevision || String(item.bytes || '');
    const entry = cached.get(item.id);
    if (entry && entry.revision === revision) return entry.promise;
    if (entry) { void entry.promise.then(url => URL.revokeObjectURL(url)).catch(() => {}); cached.delete(item.id); }
    const promise = (async () => {
      const file = await window.workbench.readMedia(item.id), parts = [];
      if (file.kind !== 'media' || file.mediaKind !== item.kind || file.bytes < 1 || file.bytes > 250000000) throw new Error('此文件无法预览');
      let offset = 0;
      while (offset < file.bytes) {
        const chunk = await window.workbench.readMedia(item.id, { offset, mediaRevision: file.mediaRevision });
        if (chunk.kind !== 'media' || chunk.mediaRevision !== file.mediaRevision || chunk.bytes !== file.bytes || chunk.mime !== file.mime || chunk.offset !== offset || typeof chunk.data !== 'string') throw new Error('素材读取结果发生变化');
        const decoded = atob(chunk.data), bytes = new Uint8Array(decoded.length); for (let index = 0; index < decoded.length; index++) bytes[index] = decoded.charCodeAt(index);
        if (!bytes.length || bytes.length > 512000 || offset + bytes.length > file.bytes) throw new Error('素材分块读取失败');
        offset += bytes.length; if (chunk.nextOffset !== (offset < file.bytes ? offset : null)) throw new Error('素材读取不完整'); parts.push(bytes); onProgress?.(Math.round(offset / file.bytes * 100));
      }
      return URL.createObjectURL(new Blob(parts, { type: file.mime }));
    })(); cached.set(item.id, { revision, promise });
    try { return await promise; } catch (error) { if (cached.get(item.id)?.promise === promise) cached.delete(item.id); throw error; }
  }

  async function documentText(item) {
    const revision = item.updatedAt || String(item.bytes || '');
    const entry = docCache.get(item.id);
    if (entry && entry.revision === revision) return entry.promise;
    const promise = (async () => {
      if (typeof window.workbench?.readArtifact === 'function') {
        const file = await window.workbench.readArtifact(item.id);
        if (file && typeof file.content === 'string') return file.content;
      }
      throw new Error('此文档暂不可预览');
    })();
    docCache.set(item.id, { revision, promise });
    try { return await promise; } catch (error) { if (docCache.get(item.id)?.promise === promise) docCache.delete(item.id); throw error; }
  }

  function thumbnail(item, container) {
    const load = () => { void mediaUrl(item).then(url => { if (!container.isConnected) return; const image = make('img', '', item.name); image.src = url; image.alt = item.name; image.loading = 'lazy'; image.onerror = () => container.replaceChildren(make('span', 'media-unavailable', '图片无法解码')); container.replaceChildren(image); }).catch(() => { if (container.isConnected) container.replaceChildren(make('span', 'media-unavailable', '图片暂不可用')); }); };
    if (typeof IntersectionObserver === 'undefined') { load(); return; }
    observer ??= new IntersectionObserver(entries => { for (const entry of entries) if (entry.isIntersecting) { observer.unobserve(entry.target); entry.target.loadThumbnail?.(); } }, { root: document.getElementById('reader'), rootMargin: '150px' });
    container.loadThumbnail = load; observer.observe(container);
  }

  function mediaReader(reader, item, meta) {
    const ticket = ++selection;
    const toolbar = make('header', 'reader-toolbar', '');
    const left = make('div', 'reader-toolbar-left', '');
    const right = make('div', 'reader-toolbar-right', '');

    if (mode === 'media') {
      const back = make('button', 'back-button', '‹ 素材总览');
      back.onclick = () => { selectedMedia = ''; render(); };
      left.append(back);
    }

    const metaBox = make('div', 'reader-meta', '');
    const breadcrumbs = make('div', 'reader-meta-breadcrumbs', '');
    if (meta?.isEpisode) {
      breadcrumbs.append(make('span', 'reader-badge', meta.episode), make('span', 'reader-stage', meta.stageTitle || '分集'));
    } else if (meta?.sectionTitle) {
      breadcrumbs.append(make('span', 'reader-badge', meta.sectionTitle));
    }
    const titleLine = make('div', 'reader-title-line', '');
    titleLine.append(make('span', 'reader-title', meta?.displayName || item.name || item.relativePath || item.id));
    if (item.bytes) titleLine.append(make('span', 'reader-path', size(item.bytes)));
    metaBox.append(breadcrumbs, titleLine);
    left.append(metaBox);

    if (item.kind === 'image') {
      const open = make('button', 'text-button', '放大预览');
      open.onclick = () => window.workbench.openMedia?.(item.id);
      right.append(open);
    }
    toolbar.append(left, right); reader.append(toolbar);

    const body = make('div', 'reader-body', '');
    const viewer = make('div', 'media-viewer', '');
    body.append(viewer); reader.append(body);

    const load = () => {
      viewer.replaceChildren(make('p', 'loading', '正在读取素材…'));
      void mediaUrl(item, percent => { if (ticket === selection && viewer.firstChild) viewer.firstChild.textContent = '正在读取素材 · ' + percent + '%'; }).then(url => {
        if (ticket !== selection) return;
        const media = make(item.kind === 'image' ? 'img' : item.kind === 'video' ? 'video' : 'audio', '', '');
        media.src = url;
        if (item.kind === 'image') {
          media.alt = item.name; media.onclick = () => window.workbench.openMedia?.(item.id);
        } else {
          media.controls = true; media.preload = 'metadata';
          if (item.kind === 'video') media.setAttribute('playsinline', '');
        }
        media.onerror = () => viewer.replaceChildren(make('p', 'media-unavailable', '当前编码无法预览，请检查源文件。'));
        viewer.replaceChildren(media);
      }).catch(error => {
        if (ticket !== selection) return;
        const retry = make('button', 'action-button', '重新读取');
        retry.onclick = load;
        viewer.replaceChildren(make('p', 'media-unavailable', error?.message || String(error)), retry);
      });
    };
    if (item.kind === 'image') load();
    else {
      const play = make('button', 'media-play', item.kind === 'video' ? '▷ 点击加载视频' : '♪ 点击加载音频');
      play.onclick = load;
      viewer.append(play);
    }
  }

  function documentReader(reader, item) {
    const meta = classifyArtifact(item);
    const mediaKind = getMediaKind(item);
    if (mediaKind) {
      const mediaItem = { ...item, kind: mediaKind, name: item.name || item.relativePath?.split('/').pop() || item.id };
      mediaReader(reader, mediaItem, meta);
      return;
    }

    const ticket = ++selection;
    const toolbar = make('header', 'reader-toolbar', '');
    const left = make('div', 'reader-toolbar-left', '');
    const right = make('div', 'reader-toolbar-right', '');

    const metaBox = make('div', 'reader-meta', '');
    const breadcrumbs = make('div', 'reader-meta-breadcrumbs', '');
    if (meta.isEpisode) {
      breadcrumbs.append(make('span', 'reader-badge', meta.episode), make('span', 'reader-stage', meta.stageTitle || '分集'));
    } else {
      breadcrumbs.append(make('span', 'reader-badge', meta.sectionTitle));
    }
    const titleLine = make('div', 'reader-title-line', '');
    titleLine.append(make('span', 'reader-title', meta.displayName));
    titleLine.append(make('span', 'reader-path', (meta.cleanPath || item.relativePath) + ' · ' + size(item.bytes)));
    metaBox.append(breadcrumbs, titleLine);
    left.append(metaBox);

    const toggle = make('button', 'text-button', documentViewMode === 'rendered' ? '查看源文' : '阅读视图');
    const copy = make('button', 'copy-button', '');
    copy.setAttribute('type', 'button');
    copy.setAttribute('aria-label', '复制文件内容');
    copy.innerHTML = '<svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="3" y="6" width="10" height="11" rx="2"></rect><path d="M7 6V4a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-2"></path></svg><span class="copy-status">复制</span>';
    right.append(toggle, copy);
    toolbar.append(left, right);
    reader.append(toolbar);

    const body = make('div', 'reader-body', '');
    reader.append(body);

    let text = '';

    copy.onclick = async () => {
      if (!text) return;
      const label = copy.querySelector?.('.copy-status');
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(text);
        } else {
          const ta = document.createElement('textarea');
          ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
          document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
        }
        if (label) label.textContent = '已复制';
        setTimeout(() => { if (label?.isConnected) label.textContent = '复制'; }, 2000);
      } catch {
        if (label) label.textContent = '复制失败';
        setTimeout(() => { if (label?.isConnected) label.textContent = '复制'; }, 2000);
      }
    };

    function renderBody() {
      if (!text) return;
      const isMd = /\.(md|markdown)$/i.test(item.relativePath || item.name || item.id || '');
      if (documentViewMode === 'rendered' && isMd) {
        body.replaceChildren(renderMarkdown(text));
      } else {
        const pre = make('pre', 'source-pre', text);
        body.replaceChildren(pre);
      }
    }

    toggle.onclick = () => {
      documentViewMode = documentViewMode === 'rendered' ? 'source' : 'rendered';
      toggle.textContent = documentViewMode === 'rendered' ? '查看源文' : '阅读视图';
      renderBody();
    };

    const load = () => {
      body.replaceChildren(make('p', 'loading', '正在读取文档…'));
      void documentText(item).then(content => {
        if (ticket !== selection) return;
        text = content;
        renderBody();
      }).catch(error => {
        if (ticket !== selection) return;
        const retry = make('button', 'action-button', '重新读取'); retry.onclick = load;
        body.replaceChildren(make('p', 'media-unavailable', error?.message || '文档暂不可用'), retry);
      });
    };
    load();
  }

  function render() {
    const artifacts = data.artifacts ?? [], media = data.media ?? [];
    const next = JSON.stringify([artifacts, media, mode, query, selectedMedia, selectedDocument]);
    if (next === signature) return;
    signature = next; ++selection; observer?.disconnect();

    for (const [id, label, count] of [['documents', '作品文档', artifacts.length], ['media', '媒体素材', media.length]]) {
      const tab = document.getElementById(id + '-tab');
      if (tab) {
        tab.textContent = label + ' · ' + count;
        tab.setAttribute('aria-pressed', String(mode === id));
      }
    }

    const tree = document.getElementById('tree');
    tree.replaceChildren();

    if (mode === 'media') {
      const mediaGroups = Object.entries(mediaNames).map(([kind, name]) => ({
        name,
        items: media.filter(item => item.kind === kind && ((item.name ?? '') + ' ' + (item.relativePath ?? '')).toLowerCase().includes(query.toLowerCase()))
      }));
      for (const group of mediaGroups) {
        const details = document.createElement('details'), key = 'media:' + group.name;
        details.open = query ? group.items.length > 0 : (expansion.get(key) ?? group.items.length > 0);
        const summary = make('summary', '', group.name);
        summary.append(make('span', '', String(group.items.length)));
        details.append(summary);
        details.ontoggle = () => { if (details.isConnected && !query) expansion.set(key, details.open); };
        for (const item of group.items) {
          const chosen = selectedMedia === item.id;
          const button = make('button', chosen ? 'selected' : '', item.name);
          button.setAttribute('aria-current', chosen ? 'true' : 'false');
          button.append(make('small', '', mediaNames[item.kind] + ' · ' + size(item.bytes)));
          button.onclick = () => { selectedMedia = item.id; render(); };
          details.append(button);
        }
        if (!group.items.length) details.append(make('p', 'empty', query ? '没有匹配素材' : '暂无素材'));
        tree.append(details);
      }
    } else {
      // 整理与分类所有作品文档
      const classified = [];
      for (const item of artifacts) {
        const meta = classifyArtifact(item);
        if (matches(item, meta)) classified.push({ item, meta });
      }

      const groups = [
        { id: 'story', title: '故事设定', items: [] },
        { id: 'assets', title: '全剧资产', items: [] },
        { id: 'episodes', title: '分集制作', isEpisodeScope: true, episodeMap: new Map(), count: 0 },
        { id: 'research', title: '研究资料', items: [] },
        { id: 'reviews', title: '审查记录', items: [] },
        { id: 'other', title: '其他资料', items: [] }
      ];

      for (const entry of classified) {
        if (entry.meta.sectionId === 'episodes') {
          groups[2].count++;
          let epGroup = groups[2].episodeMap.get(entry.meta.episode);
          if (!epGroup) {
            epGroup = {
              episode: entry.meta.episode,
              episodeTitle: entry.meta.episodeTitle,
              episodeNum: entry.meta.episodeNum,
              items: []
            };
            groups[2].episodeMap.set(entry.meta.episode, epGroup);
          }
          epGroup.items.push(entry);
        } else {
          const group = groups.find(g => g.id === entry.meta.sectionId) || groups[5];
          group.items.push(entry);
        }
      }

      for (const group of groups) {
        if (group.isEpisodeScope) {
          const details = document.createElement('details'), key = 'doc:episodes';
          details.open = query ? group.count > 0 : (expansion.get(key) ?? group.count > 0);
          const summary = make('summary', '', group.title);
          summary.append(make('span', '', String(group.count)));
          details.append(summary);
          details.ontoggle = () => { if (details.isConnected && !query) expansion.set(key, details.open); };

          const sortedEpisodes = Array.from(group.episodeMap.values()).sort((a, b) => a.episodeNum - b.episodeNum || a.episode.localeCompare(b.episode));
          for (const ep of sortedEpisodes) {
            const epDetails = document.createElement('details');
            epDetails.className = 'episode-group';
            const epKey = 'doc:ep:' + ep.episode;
            epDetails.open = query ? ep.items.length > 0 : (expansion.get(epKey) ?? true);
            const epSummary = make('summary', '', ep.episode + ' · ' + ep.episodeTitle);
            epSummary.append(make('span', '', String(ep.items.length)));
            epDetails.append(epSummary);
            epDetails.ontoggle = () => { if (epDetails.isConnected && !query) expansion.set(epKey, epDetails.open); };

            const stageBuckets = new Map();
            for (const entry of ep.items) {
              const sId = entry.meta.stageId || 'other';
              if (!stageBuckets.has(sId)) {
                stageBuckets.set(sId, { title: entry.meta.stageTitle, order: entry.meta.stageOrder || 9, items: [] });
              }
              stageBuckets.get(sId).items.push(entry);
            }

            const sortedStages = Array.from(stageBuckets.values()).sort((a, b) => a.order - b.order);
            for (const stage of sortedStages) {
              if (stage.title) {
                epDetails.append(make('div', 'stage-title', stage.title));
              }
              stage.items.sort((a, b) => (a.meta.order - b.meta.order) || a.meta.displayName.localeCompare(b.meta.displayName));
              for (const { item, meta } of stage.items) {
                const chosen = selectedDocument === item.id;
                const button = make('button', chosen ? 'selected' : '', meta.displayName);
                button.setAttribute('aria-current', chosen ? 'true' : 'false');
                button.append(make('small', '', meta.shortPath + ' · ' + size(item.bytes)));
                button.onclick = () => { selectedDocument = item.id; render(); };
                epDetails.append(button);
              }
            }
            details.append(epDetails);
          }
          if (!group.count) details.append(make('p', 'empty', query ? '没有匹配资料' : '暂无分集产物'));
          tree.append(details);
        } else {
          const details = document.createElement('details'), key = 'doc:' + group.id;
          details.open = query ? group.items.length > 0 : (expansion.get(key) ?? group.items.length > 0);
          const summary = make('summary', '', group.title);
          summary.append(make('span', '', String(group.items.length)));
          details.append(summary);
          details.ontoggle = () => { if (details.isConnected && !query) expansion.set(key, details.open); };

          group.items.sort((a, b) => (a.meta.order - b.meta.order) || a.meta.displayName.localeCompare(b.meta.displayName));
          for (const { item, meta } of group.items) {
            const chosen = selectedDocument === item.id;
            const button = make('button', chosen ? 'selected' : '', meta.displayName);
            button.setAttribute('aria-current', chosen ? 'true' : 'false');
            button.append(make('small', '', meta.shortPath + ' · ' + size(item.bytes)));
            button.onclick = () => { selectedDocument = item.id; render(); };
            details.append(button);
          }
          if (!group.items.length) details.append(make('p', 'empty', query ? '没有匹配资料' : '暂无文档'));
          tree.append(details);
        }
      }
    }

    const reader = document.getElementById('reader');
    reader.replaceChildren();

    if (mode === 'media') {
      const item = media.find(value => value.id === selectedMedia);
      if (item) { mediaReader(reader, item); return; }
      const header = make('header', 'collection-heading', '');
      header.append(make('h1', '', '媒体素材'), make('p', '', '直接查看作品中的图片、视频与音频文件。'));
      reader.append(header);
      const grid = make('div', 'asset-grid', '');
      for (const item of media.filter(it => ((it.name ?? '') + ' ' + (it.relativePath ?? '')).toLowerCase().includes(query.toLowerCase()))) {
        const button = make('button', 'asset-card', '');
        const preview = make('span', 'asset-preview ' + item.kind, item.kind === 'image' ? '▧' : item.kind === 'video' ? '▷' : '♪');
        button.onclick = () => { selectedMedia = item.id; render(); };
        button.append(preview, make('strong', '', item.name), make('small', '', mediaNames[item.kind] + ' · ' + size(item.bytes)));
        grid.append(button);
        if (item.kind === 'image') thumbnail(item, preview);
      }
      reader.append(grid);
      if (!grid.children.length) reader.append(make('p', 'empty', query ? '没有匹配的素材' : '当前作品尚无媒体文件。'));
      return;
    }

    const docItem = artifacts.find(value => value.id === selectedDocument);
    if (docItem) { documentReader(reader, docItem); return; }

    const empty = make('div', 'reader-empty', '');
    empty.append(
      make('span', '', '▤'),
      make('h1', '', '作品资料'),
      make('p', '', '从左侧选择作品文档阅读。'),
      make('small', '', '左侧目录支持故事设定、分集制作各阶段（编剧、导演规划、视频、后期）规范树形浏览。')
    );
    reader.append(empty);
  }

  for (const id of ['documents', 'media']) {
    const tab = document.getElementById(id + '-tab');
    if (tab) tab.onclick = () => { mode = id; render(); };
  }
  document.getElementById('search').oninput = event => { query = event.target.value; render(); };
  window.workbench.onData(value => { data = value; render(); });
  addEventListener('beforeunload', () => {
    observer?.disconnect();
    for (const entry of cached.values()) void entry.promise.then(url => URL.revokeObjectURL(url)).catch(() => {});
    cached.clear();
    docCache.clear();
  });
})();
