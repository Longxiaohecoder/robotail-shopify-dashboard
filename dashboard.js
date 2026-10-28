'use strict';
let snapshot;
let selectedPeriod = 'month';
const el = id => document.getElementById(id);
const escapeHtml = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt = (v, digits = 0) => v == null || !Number.isFinite(Number(v)) ? 'N/A' : Number(v).toLocaleString('zh-CN', {minimumFractionDigits:digits,maximumFractionDigits:digits});
const time = (v, zone = 'Asia/Shanghai') => new Date(v).toLocaleString('zh-CN', {timeZone:zone,hour12:false});
const card = (label, value, note, highlight = false, delta = '') => `<div class="metric-card ${highlight?'highlight':''}"><div class="metric-label">${label}</div><div class="metric-value">${value}</div><div class="metric-note">${note}</div>${delta}</div>`;
function delta(key) {
  const previous = snapshot.comparison?.summary?.[key], current = snapshot.analytics.summary[key];
  if (!snapshot.comparison?.complete || previous == null || !previous || current == null) return '';
  const d = (current - previous) / previous * 100;
  return `<div class="delta">${d>=0?'+':''}${fmt(d,1)}% 较前30天</div>`;
}
function chart(id, labels, values, title, unit, bars = false) {
  if (!values.length) return '<p class="empty">暂无可用数据</p>';
  const W=600,H=240,L=53,R=16,T=18,B=37,innerW=W-L-R,innerH=H-T-B;
  const max=Math.max(1,...values.filter(v=>v!=null)), step=innerW/Math.max(1,values.length-1);
  const x=i=>L+(values.length===1?innerW/2:i*step), y=v=>T+innerH*(1-v/max);
  let marks='';
  for(let i=0;i<5;i++) {const v=max*i/4,yy=y(v);marks+=`<line class="grid" x1="${L}" y1="${yy}" x2="${W-R}" y2="${yy}"/><text text-anchor="end" x="${L-8}" y="${yy+4}">${fmt(v,max<4?1:0)}</text>`;}
  const valid=values.map((v,i)=>v==null?null:`${x(i)},${y(v)}`);
  if(!bars) {let path=[];for(const point of [...valid,null]) {if(point)path.push(point);else if(path.length){marks+=`<polyline points="${path.join(' ')}" fill="none" stroke="#ad512e" stroke-width="2.3"/>`;path=[];}}}
  const width=Math.min(24,innerW/values.length*.65);
  values.forEach((v,i)=>{if(v==null)return;const tip=escapeHtml(`${labels[i]} · ${fmt(v,unit?'2':'0')} ${unit}`);marks+=bars?`<rect class="point" tabindex="0" x="${x(i)-width/2}" y="${y(v)}" width="${width}" height="${Math.max(.7,T+innerH-y(v))}" fill="#ad512e" rx="2"><title>${tip}</title></rect>`:`<circle class="point" tabindex="0" cx="${x(i)}" cy="${y(v)}" r="3.4" fill="#ad512e"><title>${tip}</title></circle>`;});
  [...new Set([0,Math.floor((labels.length-1)/2),labels.length-1])].forEach(i=>{marks+=`<text text-anchor="middle" x="${x(i)}" y="${H-11}">${escapeHtml(labels[i]?.slice(5))}</text>`;});
  return `<svg id="${id}" class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="${id}-title"><title id="${id}-title">${escapeHtml(title)}。${values.filter(v=>v!=null).length}个日期，${escapeHtml(unit||'次数')}。</title>${marks}</svg>`;
}
function renderProducts(query = '') {
  const currency = escapeHtml(snapshot.shopInfo.currency);
  const rows = (snapshot.periodAnalytics?.[selectedPeriod]?.analytics ?? snapshot.analytics).topProducts.filter(p=>p.name.toLowerCase().includes(query.toLowerCase()));
  el('product-body').innerHTML = rows.length ? rows.map(p=>`<tr><td class="product">${escapeHtml(p.name)}</td><td class="num">${fmt(p.quantity)}</td><td class="num">${currency} ${fmt(p.amount,2)}</td></tr>`).join('') : '<tr><td colspan="3" class="empty">没有匹配的商品</td></tr>';
}
function trafficTimeline(traffic) {
  const rows=new Map(traffic.daily.map(row=>[row.date,row.sessions]));
  const dates=[],values=[];
  for(let d=traffic.period.start;d<=traffic.period.end;d=new Date(Date.parse(d+'T12:00:00Z')+86400000).toISOString().slice(0,10)){dates.push(d);values.push(rows.has(d)?rows.get(d):null);}
  return chart('sessions-chart',dates,values,'每日会话','');
}
function renderDashboard(data) {
  snapshot=data;
  const {shopInfo:shop,traffic:t}=data;
  const selected=data.periodAnalytics?.[selectedPeriod];
  const a=selected?.analytics ?? data.analytics,s=a.summary,c=escapeHtml(shop.currency);
  const labels={today:'今天',yesterday:'昨天',week:'最近7天',month:'最近30天'};
  const age=(Date.now()-Date.parse(data.generatedAt))/3600000,stale=age>36;
  el('data-status').textContent=stale?'快照已过期':'真实数据快照';
  el('scope').textContent=`${shop.name} · ${labels[selectedPeriod]} · ${shop.timezone}`;
  el('last-update').textContent=`采集于 ${time(data.generatedAt)}（北京时间） · Shopify窗口 ${time(data.period.start,shop.timezone)} — ${time(data.period.end,shop.timezone)}`;
  let html=stale?'<p class="notice">这份快照已超过36小时，请重新采集后更新。页面重新加载只读取已保存数据。</p>':'';

  html+=`<section aria-label="订单概览"><div class="metrics-grid">${card('订单金额 · 未取消',`<small>${c}</small>${fmt(s.orderAmount,2)}`,'含税及运费，包含未付款订单',true,selectedPeriod==='month'?delta('orderAmount'):'')}${card('创建订单数',fmt(s.totalOrders),`未取消 ${fmt(s.validOrders)} · 取消 ${fmt(s.cancelledOrders)}`,false,selectedPeriod==='month'?delta('totalOrders'):'')}${card('客单价 · 未取消',`<small>${c}</small>${fmt(s.averageOrderValue,2)}`,'订单金额 ÷ 未取消订单数',false,selectedPeriod==='month'?delta('averageOrderValue'):'')}${card('全部履约率',s.fulfillmentRate==null?'N/A':fmt(s.fulfillmentRate,1)+'%',`已全部履约 ${s.fulfilledOrders} / 未取消 ${s.validOrders}`)}</div></section>`;
  html+=`<div class="chart-grid"><section class="card"><div class="card-head"><div><h2>每日订单</h2><p class="chart-sub">按创建时间 · 含取消 · ${selectedPeriod==='month'?'首尾为部分自然日':selectedPeriod==='today'||selectedPeriod==='week'?'今天为部分自然日':'完整自然日'}</p></div></div>${chart('orders-chart',a.trends.dates,a.trends.orders,'每日订单','')}</section><section class="card"><div class="card-head"><div><h2>每日订单金额</h2><p class="chart-sub">未取消订单 · ${c}</p></div></div>${chart('amount-chart',a.trends.dates,a.trends.amount,'每日订单金额',shop.currency,true)}</section></div>`;
  html+=`<div class="section-heading"><h2>流量与购买</h2><p>GA4 · 全渠道 · 固定最近30个完整自然日，不随订单筛选变化</p></div>`;
  if(t?.status==='connected') {
    const g=t.summary;
    html+=`<p class="notice">${escapeHtml(t.note)}<br>请求区间：${escapeHtml(t.period.start)} — ${escapeHtml(t.period.end)}（${escapeHtml(t.period.timezone)}）；本次首个返回日期：${escapeHtml(t.firstReturnedDate||'无')}。</p><p class="chart-sub">GA4无维度总量 ${fmt(t.summary.sessions)} 次；逐日行合计 ${fmt(t.daily.reduce((sum,r)=>sum+r.sessions,0))} 次，渠道行合计 ${fmt(t.channels.reduce((sum,r)=>sum+r.sessions,0))} 次。不同维度查询存在差异，卡片以无维度总量为准，暂不据此做渠道占比分摊。</p><div class="metrics-grid" style="margin-top:14px">${card('会话数',fmt(g.sessions),'GA4 sessions')}${card('访问用户',fmt(g.totalUsers),'GA4 区间去重 totalUsers')}${card('购买次数',fmt(g.ecommercePurchases),'GA4 ecommercePurchases')}${card('购买会话转化率',g.purchaseSessionRate==null?'N/A':fmt(g.purchaseSessionRate,2)+'%',g.purchaseSessionRate==null?escapeHtml(t.rateReason||'未返回'): '包含 purchase 关键事件的会话占比')}</div>`;
    html+=`<div class="chart-grid"><section class="card"><div class="card-head"><div><h2>每日会话</h2><p class="chart-sub">完整日期轴 · 未返回日期保留空白</p></div></div>${trafficTimeline(t)}</section><section class="card"><div class="card-head"><h2>会话来源</h2></div>${[...t.channels].sort((a,b)=>b.sessions-a.sessions).map(r=>`<div class="bar-row"><span class="bar-label">${escapeHtml(r.channel)}</span><div class="bar-track"><div class="bar-fill" style="width:${Math.min(100,r.sessions/Math.max(1,...t.channels.map(c=>c.sessions))*100)}%"></div></div><span>${fmt(r.sessions)}</span></div>`).join('')||'<p class="empty">暂无渠道数据</p>'}</section></div><div class="card" style="margin-top:20px"><h3>购物事件次数</h3><div class="status-list"><div><div class="status-number">${fmt(g.addToCarts)}</div><div class="status-label">加购</div></div><div><div class="status-number">${fmt(g.checkouts)}</div><div class="status-label">开始结账</div></div><div><div class="status-number">${fmt(g.ecommercePurchases)}</div><div class="status-label">购买</div></div></div></div>`;
  } else html+=`<p class="notice">流量数据暂不可用：${escapeHtml(t?.reason||'尚未接通GA4')}。订单指标仍来自Shopify。</p>`;
  html+=`<div class="chart-grid"><section class="card"><div class="card-head"><div><h2>热销商品 · Top 10</h2><p class="chart-sub">按当前数量排序；金额为未扣分摊折扣的商品原价金额</p></div><input id="product-search" class="search" placeholder="搜索商品" aria-label="搜索热销商品"></div><div class="table-wrap"><table><thead><tr><th>商品</th><th class="num">数量</th><th class="num">原价金额</th></tr></thead><tbody id="product-body"></tbody></table></div></section><section class="card"><div class="card-head"><h2>订单履约情况</h2></div><div class="status-list"><div><div class="status-number">${fmt(s.fulfilledOrders)}</div><div class="status-label">已全部履约</div></div><div><div class="status-number">${fmt(s.unfulfilledOrders)}</div><div class="status-label">未全部履约</div></div><div><div class="status-number">${fmt(s.cancelledOrders)}</div><div class="status-label">已取消</div></div></div><p class="muted">未取消订单中 ${fmt(s.paidOrders)} 单为已支付或退款后状态。</p><p class="chart-sub">商品总数 ${data.products.total} · active状态 ${data.products.published}</p></section></div>`;
  html+=`<details><summary>数据来源与统计口径</summary><div class="source-grid"><div><h3>Shopify</h3><p>${escapeHtml(data.provenance.shopify.source)} · 已完成分页 · ${data.provenance.shopify.pagesFetched}次请求 · 排除测试订单</p><ul>${Object.values(data.provenance.definitions).map(v=>`<li>${escapeHtml(v)}</li>`).join('')}</ul></div><div><h3>覆盖与更新</h3><p>${escapeHtml(data.comparison.reason||'环比基线完整，按相邻等长窗口比较。')}</p><ul>${data.provenance.limitations.map(v=>`<li>${escapeHtml(v)}</li>`).join('')}</ul><p>重新加载仅重读快照；重新采集需运行 npm run fetch-analytics，发布后其他设备才能看到更新。</p></div></div></details>`;
  el('dashboard-content').innerHTML=html;
  el('period-description').textContent=`店铺时区 ${shop.timezone} · ${selected?.startDate || ''} 至 ${selected?.endDate || ''} · 数据截至快照采集时间`;
  document.querySelectorAll('[data-period]').forEach(button=>{button.disabled=false;button.setAttribute('aria-pressed',String(button.dataset.period===selectedPeriod));});
  renderProducts();
  el('product-search').addEventListener('input',e=>renderProducts(e.target.value));
  el('download').disabled=false;
}
async function loadDashboard() {
  el('reload').disabled=true;
  try {
    const response=await fetch('./analytics-data.json',{cache:'no-store'});
    if(!response.ok)throw Error(`数据快照 HTTP ${response.status}`);
    const data=await response.json();
    if(data.schemaVersion!==2||data.realData!==true||!data.analytics?.summary||!data.period||!data.periodAnalytics?.today||!data.periodAnalytics?.yesterday||!data.periodAnalytics?.week||!data.periodAnalytics?.month)throw Error('快照格式过旧或不是真实数据，请重新采集');
    renderDashboard(data);
  } catch(error) {
    el('data-status').textContent='数据加载失败';
    if(snapshot)el('last-update').textContent+=' · 重新加载失败，当前仍显示上次成功快照';
    else el('dashboard-content').innerHTML=`<div class="notice error" role="alert">无法显示数据：${escapeHtml(error.message)}。请检查快照文件并重新加载。</div>`;
  } finally {el('reload').disabled=false;}
}
document.querySelectorAll('[data-period]').forEach(button=>button.addEventListener('click',()=>{if(snapshot){selectedPeriod=button.dataset.period;renderDashboard(snapshot);}}));
el('reload').addEventListener('click',loadDashboard);
el('download').addEventListener('click',()=>{if(!snapshot)return;const url=URL.createObjectURL(new Blob([JSON.stringify(snapshot,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=`robotail-${snapshot.generatedAt.slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
loadDashboard();
