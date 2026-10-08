'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const piPanel = Boolean(window.pluginBridge?.invoke);
  document.documentElement.dataset.piPanel = String(piPanel);
  const SESSION = 'workbuddy-dashboard-session';
  const state = { token: '', config: null, status: null, product: 'workbuddy', models: [], source: '', epoch: 0, stopped: false, showingKey: false, busy: false };
  let toastTimer, keyTimer, confirmation, configRevision = 0;
  const readSession = () => { if(piPanel)return '';try { return sessionStorage.getItem(SESSION) || ''; } catch { return ''; } };
  function saveSession(value) { state.token = value;if(piPanel)return;try { value ? sessionStorage.setItem(SESSION, value) : sessionStorage.removeItem(SESSION); } catch {} }
  const text = (id, value) => { $(id).textContent = value == null || value === '' ? '—' : String(value); };
  const date = value => Number.isFinite(value) ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '—';
  const sourceLabel = value => ({upstream:'实时上游',saved:'已保存目录',builtin:'内置兜底',desktop:'客户端凭据',dsh:'刷新后的本地副本'})[value] || value || '—';
  function toast(message) { clearTimeout(toastTimer); text('toast', message); $('toast').hidden = false; toastTimer = setTimeout(() => { $('toast').hidden = true; }, 4500); }
  function hideKey() { clearTimeout(keyTimer); state.showingKey = false; text('key-value', '•••• •••• •••• ••••'); $('show-key').setAttribute('aria-pressed', 'false'); $('show-key').setAttribute('aria-label', '显示 API Key'); $('key-value').parentElement.classList.remove('revealed'); }
  function banner(title, message, recovery = false) { text('banner-title', title); text('banner-text', message); $('banner').hidden = false; $('recovery').hidden = !recovery; }
  function resetSensitive() { configRevision++; hideKey(); state.config = null; text('copy-fallback', ''); $('copy-fallback').value = ''; if ($('copy-dialog').open) $('copy-dialog').close(); }
  function unauthorized(message) { state.epoch++; saveSession(''); resetSensitive(); $('workspace').hidden = true; $('bootstrap').hidden = true; $('login-panel').hidden = false; text('login-error', message || '管理会话已过期，请输入本地 Key 或运行 ui 命令授权。'); serviceBadge(false, '需要授权'); }
  function offline(message, stopped = false) { state.epoch++; resetSensitive(); state.stopped = stopped; $('workspace').hidden = true; $('bootstrap').hidden = true; $('login-panel').hidden = true; serviceBadge(false, stopped ? '服务已停止' : '服务离线'); banner(stopped ? '本地桥接服务已停止' : '无法连接本地服务', message || '请在源码目录运行 ui 命令启动。桌面网址只打开网页，不执行脚本。', true); }
  function serviceBadge(healthy, message) { $('service-state').classList.toggle('healthy', healthy); $('service-state').classList.toggle('offline', !healthy); text('service-label', message); }
  async function request(path, {method = 'GET', body, session = true} = {}) {
    if(piPanel){
      let response;
      try{response=await window.pluginBridge.invoke('workbuddy.api',{path,method,body});}catch{throw Object.assign(new Error('插件桥接未运行。请点击「重新启动桥接」，或检查插件后台服务权限。'),{offline:true});}
      if(response.status>=400)throw Object.assign(new Error(response.data?.error?.message || '面板操作失败'),{status:response.status,code:response.data?.error?.code});
      return response.data;
    }
    let response;
    try { response = await fetch('/dashboard' + path, {method, cache: 'no-store', headers: {...(session ? {Authorization: 'Bearer ' + state.token} : {}), ...(body === undefined ? {} : {'Content-Type':'application/json'})}, ...(body === undefined ? {} : {body:JSON.stringify(body)}), signal:AbortSignal.timeout(45000)}); }
    catch { throw Object.assign(new Error('无法连接本地服务，请检查后台任务和端口。'), {offline:true}); }
    let result; try { result = await response.json(); } catch { throw new Error('服务返回了无法识别的响应。'); }
    if (!response.ok) {
      const error = Object.assign(new Error(result.error?.message || '操作失败'), {status:response.status,code:result.error?.code});
      if (session && response.status === 401) unauthorized(error.message);
      throw error;
    }
    return result;
  }
  async function exchange(input) {
    const result = await request('/session', {method:'POST', body:input, session:false});
    if (!result.sessionToken) throw new Error('未收到管理会话');
    saveSession(result.sessionToken);
  }
  async function copy(value) {
    if (!value) { toast('没有可复制的内容。'); return; }
    try { if(piPanel)await window.pluginBridge.invoke('clipboard.writeText',{text:String(value)});else await navigator.clipboard.writeText(String(value)); toast('已复制，请粘贴到 PI 模型设置中。'); }
    catch { $('copy-fallback').value = String(value); $('copy-dialog').showModal(); $('copy-fallback').focus(); $('copy-fallback').select(); }
  }
  $('copy-dialog').addEventListener('close', () => { $('copy-fallback').value = ''; });
  async function freshConfig() {
    const revision = ++configRevision, epoch = state.epoch;
    const config = await request('/api/config');
    if (revision !== configRevision || epoch !== state.epoch) throw new Error('配置状态已变化，请重试。');
    if (state.config && state.config.apiKey !== config.apiKey) hideKey();
    state.config = config;
    return config;
  }
  function renderAutomation() {
    const automation = state.status?.automation || {state:'unavailable',enabled:false};
    if(automation.state==='pi-managed'){
      $('startup-toggle').disabled=true;$('startup-toggle').setAttribute('aria-checked','true');
      text('automation-state','随 PI 插件运行');text('startup-title','随 PI 启动');
      text('automation-description','PI 插件启用时自动运行；卸载插件或退出 PI 后停止。不使用 Windows 登录任务。');
      return;
    }
    $('startup-toggle').setAttribute('aria-checked', String(automation.enabled === true));
    $('startup-toggle').disabled = ['unsupported','unavailable'].includes(automation.state) || state.busy;
    text('automation-state', automation.state === 'unsupported' ? '当前平台不支持' : automation.state === 'unavailable' ? '任务状态不可用' : automation.enabled ? '登录自启动已启用' : '登录自启动已关闭');
    text('automation-description', automation.state === 'unsupported' ? '登录自启动仅支持 Windows；当前服务可继续使用。' : automation.state === 'unavailable' ? '无法读取 Windows 任务状态，请检查权限。' : '只改变下次登录启动，不中断当前连接。停止服务需使用下方按钮。');
  }
  function renderStatus() {
    if(piPanel){text('pi-runtime-state',state.status?.pluginOwned?'本插件运行中':'复用外部实例；插件不会停止它');$('migrate-bridge').hidden=state.status?.pluginOwned===true;}
    const row = state.status?.products?.find(p => p.id === state.product);
    const auth = row?.auth || {state:'signed-out'};
    const refresh = row?.refresh || {};
    text('provider-title', row?.displayName || (state.product === 'workbuddy' ? 'WorkBuddy' : 'WorkBuddy AI'));
    text('base-url', state.config?.baseUrls?.[state.product]);
    text('api-type', state.config?.apiType);
    text('version', 'v' + (state.config?.version || '0.3.0'));
    text('platform-port', state.config ? `${state.config.platform} / ${state.config.port}` : '—');
    text('home-path', state.config?.home);
    text('auth-state', auth.state === 'signed-in' ? '已登录' : '未登录');
    $('auth-dot').classList.toggle('healthy', auth.state === 'signed-in');
    $('auth-dot').classList.toggle('warning', auth.state !== 'signed-in');
    text('auth-detail', auth.nickname || (auth.state === 'signed-in' ? '凭据读取成功' : '请在对应客户端登录'));
    text('token-expiry', date(auth.expiresAtMs));
    text('refresh-expiry', '刷新令牌：' + date(auth.refreshExpiresAtMs));
    text('model-count', auth.state !== 'signed-in' ? 0 : Number.isFinite(refresh.modelCount) ? refresh.modelCount : state.models.length);
    text('catalog-detail', '目录来源：' + sourceLabel(state.source || refresh.catalogSource));
    text('checked-at', date(refresh.checkedAt));
    text('refresh-state', ({ready:'自动刷新正常','catalog-stale':'上游刷新失败，正在使用缓存','refresh-failed':'自动刷新失败，将重试','signed-out':'未登录，跳过上游请求'})[refresh.state] || '等待目录检查');
    text('auth-source', sourceLabel(auth.source)); text('reason-code', auth.reasonCode); text('reason-detail', auth.reason || (auth.state === 'signed-in' ? '认证正常，不显示原始 token。' : '登录对应 WorkBuddy 客户端后刷新。'));
    $('auth-warning').hidden = auth.state === 'signed-in';
    text('auth-warning', auth.reason || '当前渠道尚未登录。请在官方客户端登录，其他已登录渠道不受影响。');
    text('last-sync', '最近状态查询：' + date(Date.now()));
    renderAutomation();
  }
  const tokens = count => Number.isFinite(count) ? count >= 1000000 ? (count / 1000000).toFixed(1) + 'M' : Math.round(count / 1000) + 'K' : '—';
  function renderModels() {
    const query = $('model-search').value.trim().toLowerCase();
    const rows = state.models.filter(m => `${m.name} ${m.id}`.toLowerCase().includes(query));
    $('models-body').replaceChildren();
    for (const model of rows) {
      const tr = document.createElement('tr');
      const nameCell = document.createElement('td');
      const name = document.createElement('div'); name.className = 'model-name'; name.textContent = model.name || model.id;
      const id = document.createElement('code'); id.className = 'model-id'; id.textContent = model.id;
      nameCell.append(name, id); tr.append(nameCell);
      for (const value of [tokens(model.contextWindow),tokens(model.maxTokens)]) { const td = document.createElement('td'); td.textContent = value; tr.append(td); }
      const images = document.createElement('td'); const badge = document.createElement('span'); badge.className = 'capability' + (model.supportsImages ? ' yes' : ''); badge.textContent = model.supportsImages ? '支持' : '文字'; images.append(badge); tr.append(images);
      const reasoning = document.createElement('td'); reasoning.textContent = model.reasoning?.supports ? '支持推理' : '默认';
      if (model.reasoning?.supportedEfforts?.length) { const levels = document.createElement('span'); levels.className = 'efforts'; levels.textContent = model.reasoning.supportedEfforts.join(' / '); reasoning.append(levels); }
      tr.append(reasoning);
      const action = document.createElement('td'); const button = document.createElement('button'); button.type = 'button'; button.className = 'icon-button'; button.textContent = '复制'; button.setAttribute('aria-label', '复制模型 ID ' + model.id); button.addEventListener('click', () => copy(model.id)); action.append(button); tr.append(action);
      $('models-body').append(tr);
    }
    text('models-total', state.models.length); text('models-source', '目录来源：' + sourceLabel(state.source)); text('model-results', `显示 ${rows.length} / ${state.models.length} 个模型`);
    $('table-wrap').hidden = rows.length === 0; $('models-empty').hidden = rows.length > 0;
    text('empty-title', query ? '没有匹配的模型' : '暂无可用模型');
    text('empty-text', query ? '试试其他名称或模型 ID。' : '登录对应 WorkBuddy 客户端后，点击刷新目录。');
    $('clear-search').hidden = !query;
  }
  let modelLoading = false;
  async function loadModels(force = false) {
    const product = state.product, epoch = state.epoch;
    const auth = state.status?.products?.find(p => p.id === product)?.auth;
    if (!force && auth?.state !== 'signed-in') { state.models = []; state.source = ''; $('models-feedback').hidden = true; renderModels(); renderStatus(); return; }
    if (modelLoading) return;
    modelLoading = true; $('refresh-models').disabled = true;
    $('models-feedback').hidden = false; $('models-feedback').classList.add('loading'); text('models-feedback', '正在获取模型目录…');
    try {
      if (force) {
        const latestStatus = await request('/api/status');
        if (epoch !== state.epoch || product !== state.product) return;
        state.status = latestStatus;
      }
      const result = force ? await request('/api/refresh', {method:'POST',body:{product}}) : await request('/api/models?product=' + encodeURIComponent(product));
      if (epoch !== state.epoch || product !== state.product) return;
      state.models = result.models || []; state.source = result.source;
      const row = state.status?.products?.find(p => p.id === product);
      if (row && result.refresh) row.refresh = { ...row.refresh, ...result.refresh, state: result.refresh.catalogRefreshFailed ? 'catalog-stale' : 'ready' };
      $('models-feedback').hidden = !result.refresh?.catalogRefreshFailed;
      if (result.refresh?.catalogRefreshFailed) { $('models-feedback').classList.remove('loading'); text('models-feedback', '上游刷新失败，显示此前缓存；模型目录未更新。'); }
      renderModels(); renderStatus();
      if (force) toast(result.refresh?.catalogRefreshFailed ? '上游刷新失败，正在使用缓存；目录未更新。' : '模型目录已刷新，没有发送聊天请求。');
    } catch (error) {
      if (epoch !== state.epoch || product !== state.product) return;
      if (error.offline) { offline(error.message); return; }
      state.models = []; state.source = ''; renderModels(); renderStatus();
      $('models-feedback').classList.remove('loading'); text('models-feedback', error.message); $('models-feedback').hidden = false;
    } finally { modelLoading = false; $('refresh-models').disabled = false; }
  }
  let syncing = false;
  async function syncStatus() {
    if (syncing || !state.token || state.stopped) return;
    syncing = true; $('sync').disabled = true;
    try {
      const epoch = state.epoch, previous = state.status?.products?.find(p => p.id === state.product);
      const result = await request('/api/status');
      await freshConfig();
      if (epoch !== state.epoch) return;
      state.status = result;
      const current = result.products?.find(p => p.id === state.product);
      if (current?.auth?.state !== 'signed-in') { state.epoch++; state.models = []; state.source = ''; renderModels(); }
      else state.source = current.refresh?.catalogSource || state.source;
      renderStatus(); serviceBadge(true, '本机服务在线'); $('banner').hidden = true;
      if (current?.auth?.state === 'signed-in' && (previous?.auth?.state !== 'signed-in' || previous?.refresh?.catalogFetchedAt !== current.refresh?.catalogFetchedAt)) await loadModels();
    }
    catch (error) { if (error.offline) offline(error.message); else if (error.status !== 401) banner('状态查询失败', error.message); }
    finally { syncing = false; $('sync').disabled = false; }
  }
  async function loadWorkspace() {
    state.stopped = false; state.epoch++;
    $('bootstrap').hidden = false; $('login-panel').hidden = true; $('workspace').hidden = true; $('banner').hidden = true; $('recovery').hidden = true;
    try {
      await freshConfig();
      state.status = await request('/api/status');
      $('workspace').hidden = false; hideKey(); renderStatus(); serviceBadge(true, '本机服务在线');
      await loadModels();
    } catch (error) { if (error.offline) offline(error.message); else if (error.status !== 401) { unauthorized();text('login-error', error.message); } }
    finally { $('bootstrap').hidden = true; }
  }
  async function action(button, operation) { if (state.busy) return; state.busy = true; button.disabled = true; try { await operation(); } catch (error) { if(error.offline)offline(error.message); else toast(error.message); } finally { state.busy = false; button.disabled = false; renderAutomation(); } }
  function confirm(title, message, label, operation) { text('confirm-title', title); text('confirm-description', message); text('confirm-action', label); $('confirm-error').textContent = ''; confirmation = operation; $('confirm-dialog').showModal(); }
  $('confirm-action').addEventListener('click', async () => {
    if (!confirmation || state.busy) return;
    state.busy = true; $('confirm-action').disabled = true; $('confirm-cancel').disabled = true;
    try { await confirmation(); $('confirm-dialog').close(); }
    catch (error) { text('confirm-error', error.message); if(error.offline)offline(error.message); }
    finally { state.busy = false; $('confirm-action').disabled = false; $('confirm-cancel').disabled = false; renderAutomation(); }
  });
  $('confirm-dialog').addEventListener('cancel', event => { if (state.busy) event.preventDefault(); });
  $('confirm-dialog').addEventListener('close', () => { confirmation = null; });
  $('regenerate').addEventListener('click', () => confirm('重新生成本地 API Key？', '旧 Key 会立即失效，PI 中现有的模型连接必须更新为新 Key。仅更新本地桥接密钥，不改变 WorkBuddy 登录。', '确认生成新 Key', async () => {
    const result = await request('/api/key/regenerate', {method:'POST',body:{confirm:true}});
    configRevision++; state.config.apiKey = result.apiKey; hideKey(); toast('已生成新 Key，请复制并更新 PI 模型设置。');
  }));
  $('stop-service').addEventListener('click', () => confirm('停止本地桥接服务？', state.status?.owner==='pi-plugin'?'当前连接会暂停。在 PI 插件面板点击「重新启动桥接」可恢复；插件启用状态不变。':'PI 的此连接将不可用，页面随之离线。运行 ui 命令可恢复。', '确认停止服务', async () => {
    await request('/api/stop', {method:'POST',body:{confirm:true}}); offline(piPanel?'桥接已暂停。点击上方「重新启动桥接」恢复。':'服务已停止。若由 PI 插件管理，请在插件面板重新启动；独立模式使用 ui 命令。', true);
  }));
  $('startup-toggle').addEventListener('click', () => action($('startup-toggle'), async () => { const result = await request('/api/automation', {method:'POST',body:{enabled:!state.status?.automation?.enabled}}); state.status.automation = result.automation; renderAutomation(); toast(result.automation.enabled ? '已启用 Windows 登录自启动。' : '已关闭登录自启动，当前服务继续运行。'); }));
  $('show-key').addEventListener('click', () => { if (state.showingKey) { hideKey(); return; } return action($('show-key'), async () => { const config = await freshConfig(); state.showingKey = true; text('key-value', config.apiKey); $('show-key').setAttribute('aria-pressed','true'); $('show-key').setAttribute('aria-label','隐藏 API Key'); $('key-value').parentElement.classList.add('revealed'); keyTimer = setTimeout(hideKey,30000); }); });
  $('copy-url').addEventListener('click', () => copy(state.config?.baseUrls?.[state.product]));
  $('copy-key').addEventListener('click', () => action($('copy-key'), async () => { const config = await freshConfig(); await copy(config.apiKey); }));
  $('copy-config').addEventListener('click', () => action($('copy-config'), async () => { const config = await freshConfig(); await copy(`提供商名称：${state.product === 'workbuddy' ? 'WorkBuddy' : 'WorkBuddy AI'}\nAPI 类型：${config.apiType}\nBase URL：${config.baseUrls[state.product]}\nAPI Key：${config.apiKey}\n模型 ID：请从模型目录中选择并复制。\n仅适用于 OpenAI Chat Completions，不是 Responses。`); }));
  $('model-search').addEventListener('input', renderModels);
  $('clear-search').addEventListener('click', () => { $('model-search').value = ''; renderModels(); });
  $('refresh-models').addEventListener('click', () => loadModels(true));
  $('sync').addEventListener('click', syncStatus);
  $('retry').addEventListener('click', () => piPanel ? restartPlugin() : state.token ? loadWorkspace() : unauthorized());
  $('login-form').addEventListener('submit', async event => { event.preventDefault(); const apiKey = $('login-key').value.trim(); $('login-key').value = ''; $('login-submit').disabled = true; $('login-error').textContent = ''; try { await exchange({apiKey}); await loadWorkspace(); } catch(error) {text('login-error',error.message);if(error.offline)offline(error.message);} finally {$('login-submit').disabled=false;} });
  document.querySelectorAll('[data-command]').forEach(button => button.addEventListener('click', () => copy(button.dataset.command)));
  const tabs = [...document.querySelectorAll('[data-product]')];
  async function selectProduct(button) {
    state.product = button.dataset.product; state.epoch++; state.models = []; state.source = ''; hideKey(); $('model-search').value = '';
    for(const tab of tabs){const selected=tab===button;tab.setAttribute('aria-selected',String(selected));tab.tabIndex=selected?0:-1;}
    $('connection-panel').setAttribute('aria-labelledby',button.id); renderStatus(); renderModels();
    // If an old fetch is still in flight, wait before loading the selected product.
    while(modelLoading) await new Promise(r=>setTimeout(r,30));
    if(state.token && !state.stopped) await loadModels();
  }
  tabs.forEach((button,index) => {button.addEventListener('click',()=>selectProduct(button));button.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const next=event.key==='Home'?0:event.key==='End'?tabs.length-1:(index+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;tabs[next].focus();selectProduct(tabs[next]);});});
  document.querySelectorAll('.nav-item').forEach(link=>link.addEventListener('click',()=>{document.querySelectorAll('.nav-item').forEach(item=>item.classList.toggle('active',item===link));}));
  const media = matchMedia('(prefers-color-scheme: light)');
  function applyTheme() { document.documentElement.dataset.theme = $('theme').value === 'system' ? media.matches ? 'light' : 'dark' : $('theme').value; }
  $('theme').addEventListener('change',applyTheme);media.addEventListener('change',applyTheme);applyTheme();
  document.addEventListener('visibilitychange',()=>{if(document.hidden)hideKey();else if(state.token&&!state.stopped)syncStatus();});
  window.addEventListener('blur',hideKey);
  setInterval(()=>{if(!document.hidden && state.token && state.config && !state.stopped)void syncStatus();},30000);
  async function restartPlugin(){
    if(!piPanel)return;
    await action($('restart-bridge'),async()=>{await window.pluginBridge.invoke('workbuddy.start');saveSession('pi-panel');await loadWorkspace();});
  }
  $('restart-bridge').addEventListener('click',restartPlugin);
  $('migrate-bridge').addEventListener('click',()=>confirm('切换为随 PI 运行？','确认后停止并删除本项目旧 Windows 登录任务和网址入口，保留 API Key、登录副本及缓存，由当前 PI 插件接管。未知手动实例不会被停止。','确认切换',async()=>{await window.pluginBridge.invoke('workbuddy.migrate');saveSession('pi-panel');await loadWorkspace();}));
  $('open-web').hidden=!piPanel;
  $('pi-runtime').hidden=!piPanel;
  $('open-web').addEventListener('click',()=>action($('open-web'),async()=>{await window.pluginBridge.invoke('workbuddy.browser');toast('网页后台已打开并授权。');}));
  async function bootstrap() {
    if(piPanel){
      saveSession('pi-panel');
      try{await window.pluginBridge.invoke('workbuddy.start');await loadWorkspace();}
      catch{offline('桥接启动失败。检查插件后台服务权限、端口和数据目录，然后点击重新启动。');}
      finally{$('bootstrap').hidden=true;}
      return;
    }
    const fragment = new URLSearchParams(location.hash.slice(1)); const ticket = fragment.get('ticket');
    if(ticket)history.replaceState(null,'',location.pathname+location.search);
    saveSession(readSession());
    try { if(ticket)await exchange({ticket}); if(state.token)await loadWorkspace();else unauthorized('请输入本地桥接 API Key，或运行 ui 命令打开一次性授权链接。'); }
    catch(error){if(error.offline)offline(error.message);else unauthorized(error.message);}
    finally {$('bootstrap').hidden=true;}
  }
  window.addEventListener('hashchange', () => { if (new URLSearchParams(location.hash.slice(1)).has('ticket')) void bootstrap(); });
  void bootstrap();
})();
