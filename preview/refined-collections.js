/* Preview draft: quieter chrome, larger text, and official IMDb ratings. */
(function () {
  'use strict';
  var home=window.HOME_UI, data=window.HOME_DATA||{}, feed=data.feed||{items:[]};
  var $=function(id){return document.getElementById(id);}, source='continue', selected=null;
  var stage=$('stage'), originalHeroButton=$('hero-details').innerHTML;
  var enrichment=data.enrichment||{};
  function rich(item,watching){return enrichment[(watching?'nama:':item.type+':')+item.id]||null;}
  function imdbFor(item,watching){var meta=rich(item,watching),id=meta&&meta.imdbId||item.imdbId,entry=(data.imdbRatings||{})[id];return entry&&typeof entry.rating==='number'&&entry.rating>0&&entry.rating<=10?entry.rating:null;}
  function episodeMeta(item,meta){var e=meta&&meta.episode;return e&&e.season===item.season&&e.number===item.episode?e:null;}
  function safeRichAsset(value){return typeof value==='string'&&/^(?:enriched|collections)\/assets\/(?:logo-(?:movie|tv)-\d+-[a-f0-9]{12}\.(?:png|svg)|(?:backdrop|thumb)-(?:movie|tv)-\d+-[a-f0-9]{12}\.jpg)$/.test(value);}
  function openSite(url) {
    if (!/^https:\/\/30nama\.com\/(play\/\d+|search\?q=[^\s]+)$/.test(url)&&!/^https:\/\/www\.youtube\.com\/watch\?v=[A-Za-z0-9_-]{11}$/.test(url)) return home.toast('This link is unavailable.');
    if(typeof window.PalmServiceBridge==='function')home.launch('com.webos.app.browser',{target:url});else window.open(url,'_blank','noopener');
  }
  function watchTrailer(meta){if(meta&&meta.trailer&&/^[A-Za-z0-9_-]{11}$/.test(meta.trailer.youtubeKey))openSite('https://www.youtube.com/watch?v='+meta.trailer.youtubeKey);}
  function facts(meta){return [meta.year,(meta.genres||[]).join(' · '),meta.runtime?meta.runtime+' min':null,meta.certification].filter(Boolean).join('  ·  ');}
  function detailsCopy(item,meta){var score=imdbFor(item,!!item.playUrl);return (meta&&meta.overview||item.overview||'No summary is available.')+(meta?'\n\n'+facts(meta)+'  ·  IMDb '+(score===null?'—':score.toFixed(1))+(meta.cast.length?'\nCast: '+meta.cast.join(', '):'')+(meta.creators.length?'\n'+(meta.type==='tv'?'Created by: ':'Director: ')+meta.creators.join(', '):''):'');}
  var episodeLine=home.element('p','hero-episode');episodeLine.id='hero-episode';$('hero-meta').parentNode.insertBefore(episodeLine,$('hero-overview'));
  var heroActions=home.element('div','hero-actions');$('hero-details').parentNode.insertBefore(heroActions,$('hero-details'));heroActions.appendChild($('hero-details'));
  var trailerButton=home.button('','hero-button trailer-button',function(){watchTrailer(rich(selected||home.featured(),source==='continue'));});trailerButton.id='hero-trailer';trailerButton.hidden=true;heroActions.appendChild(trailerButton);
  function decorateFeatured(item,watching){
    var meta=rich(item,watching),heading=$('hero-title'),key=(watching?'nama:':item.type+':')+item.id;
    heading.setAttribute('aria-label',meta&&meta.title||item.title);heading.setAttribute('data-feature-key',key);heading.textContent='';heading.classList.remove('has-title-logo');
    var fallback=home.element('span','hero-title-fallback',meta&&meta.title||item.title);
    if(meta&&safeRichAsset(meta.logo)){
      var logo=home.element('img','hero-logo');logo.alt='';logo.setAttribute('aria-hidden','true');logo.src=meta.logo;
      var triedFallback=false;logo.onerror=function(){if(heading.getAttribute('data-feature-key')!==key)return;if(!triedFallback&&safeRichAsset(meta.pngFallback)&&meta.pngFallback!==meta.logo){triedFallback=true;logo.src=meta.pngFallback;return;}heading.textContent='';heading.classList.remove('has-title-logo');heading.appendChild(fallback);};heading.appendChild(logo);heading.classList.add('has-title-logo');
    }else heading.appendChild(fallback);
    $('hero-meta').textContent='';
    if(meta){
      if(meta.year)$('hero-meta').appendChild(home.element('span','',meta.year));
      if(meta.genres.length)$('hero-meta').appendChild(home.element('span','hero-genres',meta.genres.slice(0,2).join(' · ')));
      var episodeInfo=watching&&episodeMeta(item,meta),runtime=episodeInfo&&episodeInfo.runtime||meta.runtime;if(runtime)$('hero-meta').appendChild(home.element('span','',runtime+' min'));
      if(meta.certification)$('hero-meta').appendChild(home.element('span','hero-certification',meta.certification));
      $('hero-overview').textContent=meta.overview||item.overview||'Explore this title.';
    }
    if(!meta&&item.year)$('hero-meta').appendChild(home.element('span','',item.year));
    var score=imdbFor(item,watching);$('hero-meta').appendChild(home.element('span','hero-rating','IMDb '+(score===null?'—':score.toFixed(1))));
    var e=episodeMeta(item,meta);
    episodeLine.textContent=watching&&item.type==='tv'?episode(item)+(e&&e.title?' · '+e.title:'')+(item.seconds!==null?' · '+time(item.seconds)+' watched':''):meta&&meta.tagline||'';
    trailerButton.hidden=!(meta&&meta.trailer);
    trailerButton.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 4 12 8-12 8Z"/></svg>'+(meta&&meta.trailer&&meta.trailer.type==='Teaser'?'Watch teaser':'Watch trailer');
  }
  function episode(item) {return item.type==='tv' && item.season && item.episode?'S'+item.season+' · E'+item.episode:item.type==='tv'?'Series':'Movie';}
  function time(value) {var n=Math.floor(Number(value)||0);return Math.floor(n/3600)>0?Math.floor(n/3600)+'h '+Math.floor(n%3600/60)+'m':Math.floor(n/60)+'m';}
  function showWatching(item) {
    source='continue';selected=item;var meta=rich(item,true),featured=Object.assign({},item);if(meta&&safeRichAsset(meta.backdrop))featured.image=meta.backdrop;home.showFeatured(featured);
    $('hero-kicker').textContent='30NAMA CONTINUE WATCHING';$('hero-meta').textContent='';
    if(item.year)$('hero-meta').appendChild(home.element('span','',item.year));
    $('hero-meta').appendChild(home.element('span','',episode(item)));
    if(item.seconds!==null)$('hero-meta').appendChild(home.element('span','',time(item.seconds)+' watched'));
    if(item.rating)$('hero-meta').appendChild(home.element('span','rating','IMDb '+item.rating.toFixed(1)));
    $('hero-details').innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 4 12 8-12 8Z"/></svg>Continue watching';
    decorateFeatured(item,true);
  }
  function watchingDetails(item) {
    if(!item)return;
    var meta=rich(item,true),e=episodeMeta(item,meta),summary=detailsCopy(item,meta)+'\n\n'+episode(item)+(e&&e.title?' · '+e.title:'')+(item.seconds!==null?' · '+time(item.seconds)+' watched':'');
    var actions=[{label:'Resume on 30nama',run:function(){openSite(item.playUrl);}}];
    if(meta&&meta.trailer)actions.push({label:meta.trailer.type==='Teaser'?'Watch teaser':'Watch trailer',run:function(){watchTrailer(meta);}});
    if(e&&e.overview)actions.push({label:'Show episode summary',run:function(){
      var button=$('dialog-actions').querySelector('[data-episode-summary]');
      var shown=button&&button.getAttribute('aria-expanded')==='true';$('dialog-copy').textContent=summary+(shown?'':'\n\nEPISODE SUMMARY\n'+e.overview);
      if(button){button.textContent=shown?'Show episode summary':'Hide episode summary';button.setAttribute('aria-expanded',String(!shown));}
    }});
    home.dialog(meta&&meta.title||item.title,summary,actions);
    var summaryButton=[].filter.call($('dialog-actions').querySelectorAll('button'),function(b){return b.textContent==='Show episode summary';})[0];if(summaryButton){summaryButton.setAttribute('data-episode-summary','');summaryButton.setAttribute('aria-expanded','false');}
    $('dialog-label').textContent='30NAMA CONTINUE WATCHING';
  }

  // The featured title stays fixed; only apps and content rows scroll below it.
  var scroller=home.element('div','browse-scroll'),sheet=home.element('div','browse-sheet'),feeds=home.element('div','content-feeds');
  scroller.id='browse-scroll';sheet.id='browse-sheet';feeds.id='content-feeds';
  scroller.setAttribute('aria-label','Home content');scroller.appendChild(sheet);stage.insertBefore(scroller,$('hero'));
  $('hero').setAttribute('aria-label','Featured title');
  sheet.appendChild($('content'));sheet.appendChild($('empty'));sheet.appendChild(feeds);
  var watching=home.element('section','feed-section');watching.id='watching';watching.setAttribute('aria-labelledby','watching-heading');
  feeds.appendChild(watching);feeds.appendChild($('popular'));
  var titleRows=[];
  function featureTitle(item,rowTitle){source='general';selected=item;var meta=rich(item,false),featured=Object.assign({},item);if(meta&&safeRichAsset(meta.backdrop))featured.image=meta.backdrop;home.showFeatured(featured);$('hero-kicker').textContent=rowTitle.toUpperCase();$('hero-details').innerHTML=originalHeroButton;decorateFeatured(item,false);}
  var featureTimer=null,featureDelay=110,warmImages={},warmOrders={logo:[],backdrop:[]};
  function warmAsset(value){if(!safeRichAsset(value)||warmImages[value])return;var kind=value.indexOf('/logo-')>=0?'logo':'backdrop',order=warmOrders[kind],image=new Image();image.src=value;warmImages[value]=image;order.push(value);if(image.decode)image.decode().catch(function(){});while(order.length>(kind==='logo'?6:3))delete warmImages[order.shift()];}
  function queueFeature(item,watching,rowTitle){
    clearTimeout(featureTimer);selected=item;source=watching?'continue':'general';
    var key=(watching?'nama:':item.type+':')+item.id;
    if($('hero-title').getAttribute('data-feature-key')===key){$('hero-kicker').textContent=watching?'30NAMA CONTINUE WATCHING':rowTitle.toUpperCase();return;}
    featureTimer=setTimeout(function(){featureTimer=null;if(watching)showWatching(item);else featureTitle(item,rowTitle);var meta=rich(item,watching);if(meta)warmAsset(meta.logo);var list=watching?feed.items:((data.rows||[]).filter(function(r){return r.title===rowTitle;})[0]||{}).items||[],index=list.indexOf(item);[list[index-1],list[index+1]].filter(Boolean).forEach(function(neighbour){var m=rich(neighbour,watching);if(m){warmAsset(m.logo);warmAsset(m.backdrop);}});},featureDelay);
    featureDelay=110;
  }
  function card(item,watching,rowId,rowTitle){
    var b=home.button('','poster'+(watching?' watching-poster':''),function(){if(watching)watchingDetails(item);else home.showTitle(item);});
    b.id=watching?'watching-'+item.id:'content-'+rowId+'-'+item.type+'-'+item.id;b.dataset.content=(watching?'30nama:':item.type+':')+item.id;b.setAttribute('aria-label',item.title+(watching?' · '+episode(item):''));
    var enriched=rich(item,watching),cardImage=enriched&&safeRichAsset(enriched.thumbnail)?enriched.thumbnail:enriched&&safeRichAsset(enriched.backdrop)?enriched.backdrop:item.image;
    if(cardImage&&(safeRichAsset(cardImage)||/^nama\/images\/30nama-\d+-[a-f0-9]{12}\.jpg$/.test(cardImage))){var img=home.element('img');img.alt='';img.draggable=false;img.loading='lazy';img.src=cardImage;b.appendChild(img);}
    if(watching&&item.type==='tv'&&item.season&&item.episode)b.appendChild(home.element('span','poster-kind',episode(item)));b.appendChild(home.element('span','poster-name',item.title.replace(/\s+(19|20)\d{2}\s*$/,'')));
    if(watching){b.appendChild(home.element('span','watching-time',item.seconds!==null?time(item.seconds)+' watched':'Ready to watch'));if(item.progress!==null){var track=home.element('span','watching-progress'),bar=home.element('span');bar.style.width=Math.max(0,Math.min(100,item.progress))+'%';track.appendChild(bar);b.appendChild(track);}}
    b.addEventListener('focus',function(){queueFeature(item,watching,rowTitle);});return b;
  }
  function drawRows(preserve){
    var active=document.activeElement&&document.activeElement.id,oldTitle=$('hero-title').getAttribute('data-feature-key');
    feed=data.feed||{items:[]};enrichment=data.enrichment||{};watching.textContent='';
    var heading=home.element('div','section-heading'),title=home.element('h2','','30nama continue watching');title.id='watching-heading';
    var caption=home.element('span','row-caption'),updated=feed.updatedAt?new Date(feed.updatedAt).toLocaleTimeString('en-CA',{hour:'numeric',minute:'2-digit'}):'not synced';
    caption.textContent=(data.status&&data.status.state==='connected'?'Your 30nama account':'Cached · reconnect needed')+' · Updated '+updated;
    heading.appendChild(title);heading.appendChild(caption);watching.appendChild(heading);
    var row=home.element('div','scroll-row');row.id='watching-row';watching.appendChild(row);
    (feed.items||[]).forEach(function(item){row.appendChild(card(item,true,'watching','30nama continue watching'));});
    if(!(feed.items||[]).length)watching.appendChild(home.element('p','watching-empty',data.status&&data.status.state==='connected'?'No titles in your 30nama watching list yet.':'Connect 30nama to see your watching list.'));
    titleRows.forEach(function(s){s.remove();});titleRows=[];$('popular').hidden=true;
    (data.rows||[]).forEach(function(collection){
      var section=home.element('section','feed-section'),h=home.element('div','section-heading'),t=home.element('h2','',collection.title),c=home.element('span','row-caption',collection.caption),r=home.element('div','scroll-row');
      section.id='collection-'+collection.id;t.id=section.id+'-heading';section.setAttribute('aria-labelledby',t.id);r.id=section.id+'-row';h.appendChild(t);h.appendChild(c);section.appendChild(h);section.appendChild(r);
      collection.items.forEach(function(item){r.appendChild(card(item,false,collection.id,collection.title));});feeds.appendChild(section);titleRows.push(section);
    });
    sizeSheet();
    if(preserve&&active&&$(active)){home.focus($(active));}else if(preserve&&oldTitle&&oldTitle.indexOf('nama:')===0){var found=(feed.items||[]).filter(function(i){return 'nama:'+i.id===oldTitle;})[0];if(found)showWatching(found);}
  }
  drawRows(false);
  $('hero-details').activate=function(){if(source==='continue')watchingDetails(selected);else home.showTitle(selected||home.featured());};
  window.HOME_ON_TITLE=function(item){
    var match=(data.matches||{})[item.type+':'+item.id],direct=match&&match.id&&match.canStream,url=direct?'https://30nama.com/play/'+match.id:'https://30nama.com/search?q='+encodeURIComponent(item.title);
    var b=home.button(direct?'Open in 30nama':'Search 30nama','dialog-button',function(){openSite(url);});
    $('dialog-actions').insertBefore(b,$('dialog-actions').firstChild);home.focus(b);
    var meta=rich(item,false);if(meta){$('dialog-copy').textContent=detailsCopy(item,meta);if(meta.trailer){var trailer=home.button(meta.trailer.type==='Teaser'?'Watch teaser':'Watch trailer','dialog-button',function(){watchTrailer(meta);});$('dialog-actions').insertBefore(trailer,b.nextSibling);}}
  };

  function sizeSheet(){sheet.style.height=Math.max(1080,feeds.offsetTop+feeds.offsetHeight+100)+'px';}
  var scrollFrame=null,rowOffset=0,firstVisibleRow=0,lastWheelAt=0;
  function stopScroll(){if(scrollFrame!==null)clearTimeout(scrollFrame);scrollFrame=null;}
  function glideTo(value,immediate){
    var target=Math.max(0,Math.min(sheet.offsetHeight-578-scroller.clientHeight,value));
    if(Math.abs(target-rowOffset)<.5&&!immediate)return;
    stopScroll();
    var instant=immediate||window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    rowOffset=target;sheet.style.transitionDuration=instant?'0ms':'180ms';sheet.style.transform='translate3d(0,'+(-target)+'px,0)';
    stage.classList.toggle('browse-scrolled',target>8);
    if(!instant)scrollFrame=setTimeout(function(){scrollFrame=null;},190);
  }
  function allRows(){return [$('grid')].concat([].filter.call(feeds.querySelectorAll('.scroll-row'),function(r){return r.offsetWidth>0&&r.querySelector('button');}));}
  function rowHeading(row){var section=row.id==='grid'?$('content'):row.closest('section');return section.querySelector('h1,h2');}
  function revealPair(index){
    var rows=allRows();
    if(index<firstVisibleRow)firstVisibleRow=index;
    else if(index>firstVisibleRow+1)firstVisibleRow=index-1;
    firstVisibleRow=Math.max(0,Math.min(Math.max(0,rows.length-2),firstVisibleRow));
    var heading=rowHeading(rows[firstVisibleRow]),offset=0,node=heading;
    while(node&&node!==sheet){offset+=node.offsetTop;node=node.offsetParent;}
    var desired=firstVisibleRow===0?0:offset-578-4;
    scroller.setAttribute('data-first-visible-row',String(firstVisibleRow));glideTo(desired);
  }
  // Scrolling moves cards under a stationary pointer; that must not steal focus.
  var keyboardNavigation=false,pointerX=null,pointerY=null;
  document.addEventListener('keydown',function(){keyboardNavigation=true;},true);
  document.addEventListener('mouseenter',function(e){if(keyboardNavigation&&e.target.closest&&e.target.closest('button'))e.stopPropagation();},true);
  document.addEventListener('mousemove',function(e){
    var moved=pointerX!==null&&(e.clientX!==pointerX||e.clientY!==pointerY);pointerX=e.clientX;pointerY=e.clientY;
    if(!moved)return;keyboardNavigation=false;
    var target=e.target.closest&&e.target.closest('button');if(target)home.focus(target);
  },true);
  window.HOME_MOVE=function(code){
    if(code<37||code>40||!stage.classList.contains('home-page')||!$('dialog-backdrop').hidden)return false;
    featureDelay=code===38||code===40?200:110;
    var current=document.activeElement,currentRow=current&&current.closest('.scroll-row');
    if(!currentRow)return false;
    var buttons=[].slice.call(currentRow.querySelectorAll('button')),index=buttons.indexOf(current);
    if(index<0)return false;
    if(code===37||code===39){home.focus(buttons[index+(code===37?-1:1)]);return true;}
    var rows=allRows(),next=rows[rows.indexOf(currentRow)+(code===38?-1:1)];
    if(!next)return false;
    var bounds=next.getBoundingClientRect(),here=current.getBoundingClientRect(),center=(here.left+here.right)/2,best=null,distance=Infinity;
    [].forEach.call(next.querySelectorAll('button'),function(b){var r=b.getBoundingClientRect();if(r.right<=bounds.left||r.left>=bounds.right)return;var d=Math.abs((r.left+r.right)/2-center);if(d<distance){best=b;distance=d;}});
    if(!best)return false;home.focus(best);return true;
  };
  function scrollToFocus(target){
    if(!stage.classList.contains('home-page')||!$('dialog-backdrop').hidden)return;
    if(document.querySelector('header').contains(target)){firstVisibleRow=0;glideTo(0);return;}
    if(!scroller.contains(target))return;
    var row=target.closest('.scroll-row'),index=allRows().indexOf(row);
    if(index>=0)revealPair(index);
  }
  document.addEventListener('focusin',function(e){scrollToFocus(e.target);});
  // The compositor transform owns vertical paging; browser focus scrolling must
  // not add a second offset (including on the C1's older focus implementation).
  scroller.addEventListener('scroll',function(){if(scroller.scrollTop)scroller.scrollTop=0;},{passive:true});
  scroller.addEventListener('wheel',function(e){
    if(!stage.classList.contains('home-page')||Math.abs(e.deltaY)<=Math.abs(e.deltaX))return;
    e.preventDefault();keyboardNavigation=true;
    var now=performance.now();if(scrollFrame!==null||now-lastWheelAt<280)return;lastWheelAt=now;
    var rows=allRows(),next=Math.max(0,Math.min(rows.length-2,firstVisibleRow+(e.deltaY>0?1:-1)));
    if(next===firstVisibleRow)return;
    var row=rows[e.deltaY>0?next+1:next],button=row.querySelector('button');featureDelay=200;if(button)home.focus(button);
  },{passive:false});
  var wasHome=stage.classList.contains('home-page');
  new MutationObserver(function(){var isHome=stage.classList.contains('home-page');if(isHome!==wasHome){wasHome=isHome;firstVisibleRow=0;glideTo(0,true);sizeSheet();}}).observe(stage,{attributes:true,attributeFilter:['class']});
  window.addEventListener('resize',sizeSheet);if(window.ResizeObserver)new ResizeObserver(sizeSheet).observe(feeds);sizeSheet();

  var browserArtwork='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 112 112" class="app-icon browser-artwork" aria-hidden="true"><defs><linearGradient id="browser-tile" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#215bb9"/><stop offset="1" stop-color="#0a193d"/></linearGradient><linearGradient id="browser-orb" x1="0" y1="0" x2=".8" y2="1"><stop stop-color="#8bedf4"/><stop offset=".5" stop-color="#36b8f4"/><stop offset="1" stop-color="#1764df"/></linearGradient></defs><rect width="112" height="112" rx="25" fill="url(#browser-tile)"/><rect x=".75" y=".75" width="110.5" height="110.5" rx="24.25" fill="none" stroke="#c1eaff" stroke-opacity=".16" stroke-width="1.5"/><circle cx="56" cy="56" r="35" fill="url(#browser-orb)"/><g fill="none" stroke="#d1faff" stroke-opacity=".45" stroke-width="1.5"><ellipse cx="56" cy="56" rx="15" ry="34"/><ellipse cx="56" cy="56" rx="34" ry="14"/><path d="M22 56h68"/></g><circle cx="56" cy="56" r="34.5" fill="none" stroke="#e4fcff" stroke-opacity=".55"/><path d="m76 36-11 30-29 12 11-30Z" fill="#123e8c" fill-opacity=".22"/><path d="M75 34 47 47 64 65Z" fill="#fff"/><path d="M36 77 64 65 47 47Z" fill="#c8ecff"/><path d="m75 34-11 31-28 12 11-30Z" fill="none" stroke="#fff" stroke-opacity=".6" stroke-width="1"/><circle cx="55.5" cy="56" r="3" fill="#1458a1" stroke="#fff" stroke-width="1.3"/></svg>';

  function refreshBrowserIcon(){
    var tile=$('grid').querySelector('[data-app="com.webos.app.browser"]'),old=tile&&tile.querySelector('img.app-icon');
    if(!old)return;var holder=home.element('span');holder.innerHTML=browserArtwork;old.parentNode.replaceChild(holder.firstElementChild,old);
  }
  new MutationObserver(refreshBrowserIcon).observe($('grid'),{childList:true});refreshBrowserIcon();

  $('customize').querySelector('svg').innerHTML='<path d="M3 6h3m4 0h11M3 12h11m4 0h3M3 18h5m4 0h9"/><circle cx="8" cy="6" r="2"/><circle cx="16" cy="12" r="2"/><circle cx="10" cy="18" r="2"/>';
  var gearPoints=[];for(var tooth=0;tooth<8;tooth++){[-.31,-.2,.2,.31].forEach(function(angle,index){var a=tooth*Math.PI/4+angle,r=index===1||index===2?9.5:7.7;gearPoints.push((12+Math.cos(a)*r).toFixed(2)+','+(12+Math.sin(a)*r).toFixed(2));});}
  $('settings').querySelector('svg').innerHTML='<path d="M'+gearPoints.join(' L')+' Z"/><circle cx="12" cy="12" r="3.2"/>';
  function watchingAbout(){home.dialog('30nama continue watching','Your watching list, current episode, and progress come from your connected 30nama account and are cached locally on this TV. Title logos, backdrops, cast, trailers, and episode information come from TMDB, matched by IMDb ID. Episode summaries appear only when requested.\n\nThe TV checks for updates every 15 minutes, independently of your Mac. Resume opens 30nama in the TV browser; trailers open YouTube. No trailer plays automatically. Reconnection is required if 30nama rejects the saved session; automatic renewal has not been established.',[]);$('dialog-credit').hidden=false;}
  document.querySelector('footer').remove();
  window.HOME_ABOUT=function(){home.dialog('About your content rows','Popular today uses worldwide daily trending titles from TMDB. Apple TV, HBO, and Netflix prioritise series with episodes or premieres in the past year, ranked by TMDB popularity, with catalogue favourites filling any gaps. These are our selections, not official streaming charts. A24 combines TMDB company credits with selected verified catalogue titles, with a modest boost for recent releases; it is not an exhaustive A24 catalogue.\n\nGeneral collections refresh about every six hours. Logos, artwork, cast and trailers come from TMDB. Displayed ratings come from IMDb’s official daily non-commercial dataset, matched by IMDb ID. An em dash means an IMDb rating is unavailable; a TMDB score is never substituted. The separate 30nama row reads your approved account; title and current episode identifiers are sent to TMDB for enrichment, without account credentials or playback progress. Cached rows work offline. A matched 30nama link opens the TV browser; unmatched titles use search. Playback and browser sign-in depend on 30nama.',[]);$('dialog-credit').hidden=false;};
  if(window.HOME_CONFIG&&window.HOME_CONFIG.preview){document.title='Personal Home — Outfit';var badge=home.element('div','preview-badge','MAC PREVIEW · OUTFIT');stage.appendChild(badge);}
  var refreshing=false;
  function applySnapshot(){var next=window.HOME_DATA;if(!next||next.updatedAt===data.updatedAt||!$('dialog-backdrop').hidden)return;data=next;drawRows(true);}
  function refreshSnapshot(){if(document.visibilityState!=='visible'||refreshing)return;refreshing=true;var script=document.createElement('script');script.src='collections/feed.js?v='+Date.now();script.onload=function(){refreshing=false;script.remove();applySnapshot();};script.onerror=function(){refreshing=false;script.remove();};document.head.appendChild(script);}
  new MutationObserver(function(){if($('dialog-backdrop').hidden)applySnapshot();}).observe($('dialog-backdrop'),{attributes:true,attributeFilter:['hidden']});
  setInterval(refreshSnapshot,60000);document.addEventListener('visibilitychange',function(){if(document.visibilityState==='visible')refreshSnapshot();});
  if(feed.items&&feed.items.length)showWatching(feed.items[0]);
  else if(data.rows&&data.rows[0]&&data.rows[0].items[0])featureTitle(data.rows[0].items[0],data.rows[0].title);
})();
