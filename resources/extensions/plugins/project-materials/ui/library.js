(() => {
  const mediaExtensions = {
    png: 'image', jpg: 'image', jpeg: 'image', webp: 'image', gif: 'image', svg: 'image',
    mp4: 'video', webm: 'video', mov: 'video', mkv: 'video',
    mp3: 'audio', wav: 'audio', aac: 'audio', m4a: 'audio', ogg: 'audio', flac: 'audio'
  };

  const cached = new Map(), docCache = new Map();
  let query = "", observer;

  const make = (tag, className, text) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined && text !== null && text !== '') element.textContent = text;
    return element;
  };
  const getMediaKind = item => {
    if (item.kind && ['image', 'video', 'audio'].includes(item.kind)) return item.kind;
    const ext = ((item.relativePath || item.name || item.id || '').split('.').pop() || '').toLowerCase();
    return mediaExtensions[ext];
  };

  function normalizePath(rawPath) {
    let path = (rawPath || '').replace(/\\/g, '/').trim();
    if (path.startsWith('./')) path = path.slice(2);
    if (path.startsWith('artifacts/')) path = path.slice('artifacts/'.length);
    return path;
  }

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

   // Current deliverables are grouped by their business object, not file type.
  const titles = {
    story:'故事设定', assets:'全剧资产', episodes:'分集制作', research:'研究资料', reviews:'审查记录',
    brief:'作品目标', 'project-design':'整体故事设计', blueprint:'故事蓝图', canon:'锁定事实', units:'承重单元',
    characters:'人物', costumes:'服装', scenes:'场景', props:'道具', music:'音乐',
    writing:'编剧', director:'导演规划', production:'视频制作', post:'后期交付',
    'episode-design':'单集戏剧设计', script:'分场剧本', state:'续作状态',
    'director-plan':'导演整体方案', 'performance-plan':'表演设计', 'shot-plan':'镜头规划',
    'bgm-plan':'背景音乐规划', clips:'视频片段', references:'本集参考素材', assembly:'成片',
    'asset-registry.json':'素材登记', 'production.json':'制作索引', 'design.md':'设计说明',
    'prompt.md':'生成提示词', 'track.md':'曲目设计'
  };
  const branchOrder = ['story','assets','episodes','research','reviews','brief','project-design','blueprint','canon','units',
    'asset-registry.json','characters','costumes','scenes','props','music','writing','director','production','post',
    'episode-design','script','state','director-plan','performance-plan','shot-plan','bgm-plan','production.json','clips','references','assembly'];
  const rank = key => { const i = branchOrder.indexOf(key); return i < 0 ? 999 : i; };
  const parts = path => path.split('/').filter(Boolean);
  const parent = path => parts(path).slice(0,-1).join('/');
  const basename = path => parts(path).at(-1) || '';
  const archivePath = path => parts(path).includes('archive');
  const pathOf = item => normalizePath(item.relativePath || item.name || item.id || '');
  let unifiedFiles = new Map(), nodes = new Map(), indexMeta = new Map(), indexErrors = new Map();
  let chosenPath = '', refreshTicket = 0, unifiedSignature = '', expandedPaths = new Set();
  let selectedArchive = new Map();
  function validPath(path) {
    return typeof path === 'string' && path.length && !path.startsWith('/') && !parts(path).some(p => p === '..' || p === '.');
  }
  function objectPath(path) {
    const p = parts(path);
    if (p[0] === 'assets' && ['characters','costumes','scenes','props','music'].includes(p[1]) && p.length >= 4) return p.slice(0,3).join('/');
    if (p[0] === 'episodes' && /^EP\d+$/i.test(p[1] || '')) {
      if (['writing','director'].includes(p[2]) && p.length >= 5) return p.slice(0,4).join('/');
      if (p[2] === 'production' && ['clips','references'].includes(p[3]) && p.length >= 6) return p.slice(0,5).join('/');
      if (p[2] === 'post' && p[3] === 'assembly' && p.length >= 5) return p.slice(0,4).join('/');
    }
    if (p[0] === 'story' && p[1] === 'units' && p.length >= 4) return p.slice(0,3).join('/');
    if (p[0] === 'story' && ['brief','project-design','blueprint','canon'].includes(p[1]) && p.length >= 3) return p.slice(0,2).join('/');
    if (['research','reviews'].includes(p[0]) && p.length >= 3) return p.slice(0,2).join('/');
    return null;
  }
  function ensureNode(path, kind = 'folder') {
    if (nodes.has(path)) return nodes.get(path);
    const name = basename(path);
    const node = {path, name, label: titles[name] || name || '作品资料', kind, children:[], files:[], archives:[]};
    nodes.set(path,node);
    if (path) ensureNode(parent(path)).children.push(node);
    return node;
  }
  function orderedChildren(node) {
    return [...node.children].sort((a,b) => {
      const ma = indexMeta.get(a.path), mb = indexMeta.get(b.path);
      if (ma?.order !== undefined || mb?.order !== undefined) return (ma?.order ?? 1e6) - (mb?.order ?? 1e6);
      return rank(a.name) - rank(b.name) || a.name.localeCompare(b.name,'zh-CN',{numeric:true});
    });
  }
  function buildUnifiedTree() {
    nodes = new Map(); ensureNode('');
    for (const [path,item] of unifiedFiles) {
      if (archivePath(path)) continue;
      const root = objectPath(path);
      if (root) {
        const node = ensureNode(root,'object'); node.kind='object'; node.files.push({path,item});
      } else {
        const node = ensureNode(path,'file'); node.kind='file'; node.files.push({path,item});
      }
    }
    for (const [path,item] of unifiedFiles) {
      if (!archivePath(path)) continue;
      const root = parts(path).slice(0,parts(path).indexOf('archive')).join('/');
      const node = nodes.get(root);
      if (node?.kind === 'object') node.archives.push({path,item});
      else if (node) node.archives.push({path,item});
      else {
        let owner=parent(root);
        while(owner&&!nodes.has(owner))owner=parent(owner);
        nodes.get(owner).archives.push({path,item});
      }
    }
    for (const [path,meta] of indexMeta) {
      const node = nodes.get(path);
      if (node && meta.name) node.label = /^C\d+/i.test(node.name) ? node.name + ' · ' + meta.name : meta.name;
    }
    if (!nodes.has(chosenPath)) chosenPath='';
  }
  function choose(path) {
    chosenPath=path;
    let ancestor=parent(path);
    while (ancestor) { expandedPaths.add(ancestor); ancestor=parent(ancestor); }
    renderUnified();
  }
  function nodeMatches(node) {
    const q=query.trim().toLowerCase();
    return !q || (node.label+' '+node.path).toLowerCase().includes(q) ||
      node.files.some(f => f.path.toLowerCase().includes(q)) || node.children.some(nodeMatches);
  }
  function renderBranch(node, container) {
    if (!nodeMatches(node)) return;
    const wrapper=make('div','unified-node');
    const line=make('div','unified-line'+(chosenPath===node.path?' selected':''));
    const isBranch=node.kind==='folder' && node.children.length>0;
    const toggle=make('button','tree-toggle',isBranch?(expandedPaths.has(node.path)||query?'⌄':'›'):'');
    toggle.type='button'; toggle.disabled=!isBranch;
    toggle.setAttribute('aria-label', '展开或收起 '+node.label);
    if (isBranch) toggle.onclick=()=>{ if(expandedPaths.has(node.path))expandedPaths.delete(node.path);else expandedPaths.add(node.path);renderUnified(); };
    const label=make('button','tree-label',node.label);
    label.type='button';label.title=node.path;label.setAttribute('aria-current', chosenPath===node.path?'true':'false');
    label.onclick=()=>{if(isBranch)expandedPaths.add(node.path);choose(node.path);};
    line.append(toggle,label);wrapper.append(line);
    if (isBranch && (expandedPaths.has(node.path)||query)) {
      const child=make('div','unified-children');
      orderedChildren(node).forEach(n=>renderBranch(n,child));wrapper.append(child);
    }
    container.append(wrapper);
  }
  function folderMedia(node) {
    const meta=indexMeta.get(node.path);
    const explicit=meta?.media;
    if(explicit) {
      const found=node.files.find(f=>f.path===explicit && getMediaKind(f.item));
      return found;
    }
    return node.files.find(f=>parent(f.path)===node.path && getMediaKind(f.item) && /^(board|video|audio|final)\./i.test(basename(f.path))) ||
      node.files.find(f=>parent(f.path)===node.path && getMediaKind(f.item));
  }
  async function showMedia(container,file,auto=false) {
    const item=file.item, kind=getMediaKind(item);
    const load=async()=>{
      container.replaceChildren(make('p','loading','正在读取素材…'));
      try {
        const url=await mediaUrl({...item,kind}, percent=>{if(container.isConnected&&container.firstChild)container.firstChild.textContent='正在读取素材 · '+percent+'%';});
        if(!container.isConnected)return;
        const el=make(kind==='image'?'img':kind==='video'?'video':'audio');
        el.src=url;
        if(kind==='image'){el.alt=basename(file.path);el.onclick=()=>window.workbench.openMedia?.(item.id);}
        else {el.controls=true;el.preload='metadata';if(kind==='video')el.setAttribute('playsinline','');}
        el.onerror=()=>container.replaceChildren(make('p','media-unavailable','当前编码无法预览'));
        container.replaceChildren(el);
      }catch(error){if(container.isConnected){const retry=make('button','action-button','重新读取');retry.onclick=load;container.replaceChildren(make('p','media-unavailable',error?.message||'无法读取素材'),retry);}}
    };
    if(auto||kind==='image')await load();
    else {const btn=make('button','media-play',kind==='video'?'▷ 加载视频':'♪ 加载音频');btn.onclick=load;container.replaceChildren(btn);}
  }
  function showDocument(container,file,plain=false) {
    container.replaceChildren(make('p','loading','正在读取文档…'));
    void documentText(file.item).then(text=>{
      if(!container.isConnected)return;
      const toolbar=make('div','detail-actions');
      const copy=make('button','text-button','复制');
      copy.onclick=async()=>{try{if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(text);else{const t=make('textarea');t.value=text;t.style.position='fixed';t.style.opacity='0';document.body.append(t);t.select();document.execCommand('copy');t.remove();}copy.textContent='已复制';}catch{copy.textContent='复制失败';}};
      const body=make('div');
      let source=plain||!/\.md$/i.test(file.path);
      const renderText=()=>body.replaceChildren(source?make('pre','source-pre',text):renderMarkdown(text));
      const toggle=make('button','text-button',source?'阅读视图':'查看源文');
      toggle.onclick=()=>{source=!source;toggle.textContent=source?'阅读视图':'查看源文';renderText();};
      if(/\.md$/i.test(file.path))toolbar.append(toggle);
      toolbar.append(copy);renderText();container.replaceChildren(toolbar,body);
    }).catch(error=>{if(container.isConnected)container.replaceChildren(make('p','media-unavailable',error?.message||'文档暂不可用'));});
  }
  function fileSection(body,file,title,open=true) {
    const details=make('details','detail-section'); details.open=open;
    details.append(make('summary','',title||titles[basename(file.path)]||basename(file.path)));
    const content=make('div','detail-content'); details.append(content);body.append(details);
    let loaded=false;
    const load=()=>{if(loaded||!details.open)return;loaded=true;if(getMediaKind(file.item)){content.classList.add('inline-media');void showMedia(content,file);}else showDocument(content,file,basename(file.path)==='prompt.md');};
    details.ontoggle=load;load();
  }
  function renderKeyframes(body,node,info) {
    const indexed=Array.isArray(info?.frames)?info.frames:[];
    const actual=node.files.filter(f=>f.path.startsWith(node.path+'/frames/')&&getMediaKind(f.item)==='image');
    const byPath=new Map(actual.map(f=>[f.path,f]));
    const entries=indexed.map(f=>({...f,file:byPath.get(f.path)}));
    const used=new Set(indexed.map(f=>f.path));
    for(const file of actual)if(!used.has(file.path))entries.push({path:file.path,file});
    if(!entries.length)return;
    entries.sort((a,b)=>(Number.isFinite(a.time)?a.time:Infinity)-(Number.isFinite(b.time)?b.time:Infinity)||a.path.localeCompare(b.path,'zh-CN',{numeric:true}));
    const section=make('details','detail-section');
    section.append(make('summary','','关键帧 · '+entries.length));
    const content=make('div','detail-content');section.append(content);body.append(section);
    let loaded=false;
    section.ontoggle=()=>{
      if(!section.open||loaded)return;loaded=true;
      const grid=make('div','keyframe-grid');
      const preview=make('div','keyframe-preview');
      for(const entry of entries){
        const card=make('button','overview-card keyframe-card');
        const label=Number.isFinite(entry.time)?entry.time.toFixed(2)+' 秒':basename(entry.path);
        card.append(make('strong','',label));
        if(entry.purpose)card.append(make('small','',String(entry.purpose)));
        if(entry.file){
          const image=make('div','overview-thumbnail','图片');card.prepend(image);
          thumbnail({...entry.file.item,kind:'image'},image);
          card.onclick=()=>{preview.replaceChildren();const head=make('p','detail-meta',label+' · '+basename(entry.path));const viewer=make('div','inline-media');preview.append(head,viewer);void showMedia(viewer,entry.file);};
        }else{
          card.disabled=true;card.append(make('small','','文件缺失'));
        }
        grid.append(card);
      }
      content.append(grid,preview);
    };
  }
  function renderArchive(body,node) {
    if(!node.archives.length)return;
    const archive=make('details','detail-section archive-section');archive.open=selectedArchive.get(node.path)||false;
    archive.append(make('summary','','归档资料 · '+node.archives.length));
    const content=make('div','detail-content');archive.append(content);
    const dirs=new Map([['',content]]);
    function directory(path) {
      if(dirs.has(path))return dirs.get(path);
      const d=make('details','archive-dir');d.append(make('summary','',basename(path)));
      const children=make('div','archive-children');d.append(children);directory(parent(path)).append(d);dirs.set(path,children);return children;
    }
    for(const file of [...node.archives].sort((a,b)=>a.path.localeCompare(b.path,'zh-CN',{numeric:true}))){
      const relative=file.path.slice(node.path?node.path.length+1:0).replace(/^archive\//,'');
      fileSection(directory(parent(relative)),file,basename(file.path),false);
    }
    archive.ontoggle=()=>selectedArchive.set(node.path,archive.open);body.append(archive);
  }
  function renderOverview(body,node) {
    const grid=make('div','overview-grid');
    const visible=orderedChildren(node).flatMap(child=>node.name==='production'&&child.name==='clips'?orderedChildren(child):[child]);
    for(const child of visible.filter(nodeMatches)){
      const card=make('button','overview-card');
      const preview=folderMedia(child);
      if(preview&&getMediaKind(preview.item)==='image'){
        const image=make('div','overview-thumbnail','图片');card.append(image);
        thumbnail({...preview.item,kind:'image'},image);
      }else if(preview&&getMediaKind(preview.item)==='video')card.append(make('div','overview-thumbnail','▷'));
      const label=make('strong','',child.label);card.append(label);
      if(child.kind==='folder')card.append(make('small','',child.children.length+' 项'));
      card.onclick=()=>{if(child.kind==='folder')expandedPaths.add(child.path);choose(child.path);};
      grid.append(card);
    }
    body.append(grid);
    if(!grid.children.length)body.append(make('p','empty','当前分类暂无正式资料'));
  }
  function renderUnified() {
    observer?.disconnect();
    const tree=document.getElementById('tree');const scrollTop=tree.scrollTop;tree.replaceChildren();
    const root=nodes.get('')||ensureNode('');
    orderedChildren(root).forEach(node=>renderBranch(node,tree));
    tree.scrollTop=scrollTop;
    const reader=document.getElementById('reader');reader.replaceChildren();
    const node=nodes.get(chosenPath)||root;
    const toolbar=make('header','reader-toolbar');
    const meta=make('div','reader-meta');
    const crumbs=make('div','reader-path',parts(node.path).map((p,i)=>nodes.get(parts(node.path).slice(0,i+1).join('/'))?.label||titles[p]||p).join(' / ')||'当前作品');
    meta.append(crumbs,make('div','reader-title',node.label));toolbar.append(meta);reader.append(toolbar);
    const body=make('div','reader-body unified-reader');reader.append(body);
    for(const [path,error] of indexErrors)if(!node.path||path.startsWith(node.path+'/')||node.path.startsWith(parent(path)+'/'))body.append(make('p','index-notice',error));
    if(node.kind==='folder'){renderOverview(body,node);renderArchive(body,node);return;}
    const primary=folderMedia(node);
    if(primary)fileSection(body,primary,'当前素材',true);
    const info=indexMeta.get(node.path);
    if(info?.media&&!primary)body.append(make('p','index-notice','登记的当前媒体不可读取：'+info.media));
    if(info?.status)body.append(make('p','detail-meta','制作状态：'+info.status+'（不代表成片验收）'));
    if(info?.scene||info?.shots?.length){
      const line=make('p','detail-meta', [info.scene,info.shots?.length?'关联镜头 '+info.shots.join('、'):''].filter(Boolean).join(' · '));body.append(line);
    }
    const sorted=[...node.files].sort((a,b)=>{
      const r=f=>basename(f.path)==='prompt.md'?2:basename(f.path)==='design.md'||basename(f.path)==='track.md'?0:parent(f.path)===node.path?1:3;
      return r(a)-r(b)||a.path.localeCompare(b.path,'zh-CN',{numeric:true});
    });
    const framePaths=new Set(node.files.filter(f=>f.path.startsWith(node.path+'/frames/')&&getMediaKind(f.item)==='image').map(f=>f.path));
    for(const file of sorted){
      if(file===primary)continue;
      if(framePaths.has(file.path))continue;
      const relative=node.kind==='file'?basename(file.path):file.path.slice(node.path.length+1);
      fileSection(body,file,titles[relative]||relative,node.kind==='file'||(parent(file.path)===node.path && !getMediaKind(file.item)));
    }
    renderKeyframes(body,node,info);
    if(!node.files.length)body.append(make('p','empty','暂无当前正式成果'));
    renderArchive(body,node);
  }
  async function loadIndexes() {
    const ticket=++refreshTicket;
    const next=new Map(), errors=new Map();
    const list=[...unifiedFiles].filter(([path,item])=>!getMediaKind(item)&& (path==='assets/asset-registry.json'||/^episodes\/EP\d+\/production\/production\.json$/i.test(path)));
    await Promise.all(list.map(async([path,item])=>{
      try{
        const index=JSON.parse(await documentText(item));
        if(path==='assets/asset-registry.json'){
          if(!Array.isArray(index.assets))throw new Error('缺少 assets 数组');
          const kinds={character:'characters',costume:'costumes',scene:'scenes',prop:'props'};
          index.assets.forEach(entry=>{
            if(!entry||typeof entry.asset_id!=='string'||!kinds[entry.kind])return;
            const root='assets/'+kinds[entry.kind]+'/'+entry.asset_id;
            if(!validPath(root))return;
            next.set(root,{name:entry.name,media:validPath(entry.image_board_path)?entry.image_board_path:null});
          });
        }else{
          if(!Array.isArray(index.clips))throw new Error('缺少 clips 数组');
          index.clips.forEach((clip,order)=>{
            if(!clip||typeof clip.id!=='string'||clip.id.includes('/'))return;
            const root=parent(path)+'/clips/'+clip.id;
            const shots=(Array.isArray(index.shots)?index.shots:[]).filter(s=>Array.isArray(s.segments)&&s.segments.some(seg=>seg.clipId===clip.id)).map(s=>s.shot).filter(Boolean);
            const frames=(Array.isArray(clip.frames)?clip.frames:[]).filter(f=>f&&validPath(f.path)&&f.path.startsWith(root+'/frames/')&&!archivePath(f.path));
            next.set(root,{name:clip.name,order,scene:clip.scene,shots,status:clip.status,media:validPath(clip.video)?clip.video:null,frames});
          });
        }
      }catch(error){errors.set(path,'索引暂不可读：'+path+' · '+(error?.message||'未知错误'));}
    }));
    if(ticket!==refreshTicket)return;
    const paths=[...unifiedFiles.keys()].filter(p=>!archivePath(p));
    if(paths.some(p=>/^assets\/(characters|costumes|scenes|props)\//.test(p))&&!unifiedFiles.has('assets/asset-registry.json'))errors.set('assets/asset-registry.json','尚未发现素材登记索引；当前按实际目录浏览。');
    for(const path of paths){
      const match=path.match(/^(episodes\/EP\d+\/production)\/clips\//i);
      if(match&&!unifiedFiles.has(match[1]+'/production.json'))errors.set(match[1]+'/production.json','尚未发现视频制作索引；当前按实际目录浏览，顺序未经确认。');
    }
    indexMeta=next;indexErrors=errors;buildUnifiedTree();renderUnified();
  }
  document.getElementById('search').oninput = event => { query = event.target.value; renderUnified(); };
  window.workbench.onData(value => {
    const artifacts=value?.artifacts??[], media=value?.media??[];
    const next=JSON.stringify([artifacts,media]);if(next===unifiedSignature)return;unifiedSignature=next;
    unifiedFiles=new Map();
    for(const item of [...artifacts,...media]){
      const path=pathOf(item);if(!validPath(path))continue;
      if(!unifiedFiles.has(path)||getMediaKind(item))unifiedFiles.set(path,item);
    }
    indexMeta=new Map();indexErrors=new Map();buildUnifiedTree();renderUnified();void loadIndexes();
  });
  addEventListener('beforeunload', () => {
    observer?.disconnect();
    for (const entry of cached.values()) void entry.promise.then(url => URL.revokeObjectURL(url)).catch(() => {});
    cached.clear();
    docCache.clear();
  });
})();
