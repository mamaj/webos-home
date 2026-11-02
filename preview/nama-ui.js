/* Local preview extension. Loaded only by the Mac preview server. */
(function () {
  'use strict';
  var home=window.HOME_PREVIEW, data=window.NAMA_PREVIEW_DATA||{}, feed=data.feed||{items:[]};
  var $=function(id){return document.getElementById(id);}, source='continue', selected=null;
  var stage=$('stage'), originalHeroButton=$('hero-details').innerHTML;
  var enrichment=data.enrichment||{},popularItems=(window.CINEMA_FEED||{}).items||[];
  function rich(item,watching){return enrichment[(watching?'nama:':item.type+':')+item.id]||null;}
  function episodeMeta(item,meta){var e=meta&&meta.episode;return e&&e.season===item.season&&e.number===item.episode?e:null;}
  function safeRichAsset(value){return typeof value==='string'&&/^enriched\/assets\/(?:logo-(?:movie|tv)-\d+-[a-f0-9]{12}\.png|backdrop-(?:movie|tv)-\d+-[a-f0-9]{12}\.jpg)$/.test(value);}
  function openSite(url) {
    if (!/^https:\/\/30nama\.com\/(play\/\d+|search\?q=[^\s]+)$/.test(url)&&!/^https:\/\/www\.youtube\.com\/watch\?v=[A-Za-z0-9_-]{11}$/.test(url)) return home.toast('This link is unavailable.');
    window.open(url,'_blank','noopener');
  }
  function watchTrailer(meta){if(meta&&meta.trailer&&/^[A-Za-z0-9_-]{11}$/.test(meta.trailer.youtubeKey))openSite('https://www.youtube.com/watch?v='+meta.trailer.youtubeKey);}
  function facts(meta){return [meta.year,(meta.genres||[]).join(' · '),meta.runtime?meta.runtime+' min':null,meta.certification].filter(Boolean).join('  ·  ');}
  function detailsCopy(item,meta){return (meta&&meta.overview||item.overview||'No summary is available.')+(meta?'\n\n'+facts(meta)+(meta.cast.length?'\nCast: '+meta.cast.join(', '):'')+(meta.creators.length?'\n'+(meta.type==='tv'?'Created by: ':'Director: ')+meta.creators.join(', '):''):'');}
  var episodeLine=home.element('p','hero-episode');episodeLine.id='hero-episode';$('hero-meta').parentNode.insertBefore(episodeLine,$('hero-overview'));
  var heroActions=home.element('div','hero-actions');$('hero-details').parentNode.insertBefore(heroActions,$('hero-details'));heroActions.appendChild($('hero-details'));
  var trailerButton=home.button('','hero-button trailer-button',function(){watchTrailer(rich(home.featured(),source==='continue'));});trailerButton.id='hero-trailer';trailerButton.hidden=true;heroActions.appendChild(trailerButton);
  function decorateFeatured(item,watching){
    var meta=rich(item,watching),heading=$('hero-title'),key=(watching?'nama:':item.type+':')+item.id;
    heading.setAttribute('aria-label',meta&&meta.title||item.title);heading.setAttribute('data-feature-key',key);heading.textContent='';heading.classList.remove('has-title-logo');
    var fallback=home.element('span','hero-title-fallback',meta&&meta.title||item.title);
    if(meta&&safeRichAsset(meta.logo)){
      var logo=home.element('img','hero-logo'+(meta.logoTone==='dark'?' monochrome':''));logo.alt='';logo.setAttribute('aria-hidden','true');logo.src=meta.logo;
      logo.onerror=function(){if(heading.getAttribute('data-feature-key')!==key)return;heading.textContent='';heading.classList.remove('has-title-logo');heading.appendChild(fallback);};heading.appendChild(logo);heading.classList.add('has-title-logo');
    }else heading.appendChild(fallback);
    if(meta){
      $('hero-meta').textContent='';
      if(meta.year)$('hero-meta').appendChild(home.element('span','',meta.year));
      if(meta.genres.length)$('hero-meta').appendChild(home.element('span','hero-genres',meta.genres.slice(0,2).join(' · ')));
      var episodeInfo=watching&&episodeMeta(item,meta),runtime=episodeInfo&&episodeInfo.runtime||meta.runtime;if(runtime)$('hero-meta').appendChild(home.element('span','',runtime+' min'));
      if(meta.certification)$('hero-meta').appendChild(home.element('span','hero-certification',meta.certification));
      if(meta.rating)$('hero-meta').appendChild(home.element('span','hero-rating','TMDB '+meta.rating.toFixed(1)));
      $('hero-overview').textContent=meta.overview||item.overview||'Explore this title.';
    }
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
  var heading=home.element('div','section-heading'),title=home.element('h2','','30nama continue watching');title.id='watching-heading';
  var caption=home.element('span','row-caption'),updated=feed.updatedAt?new Date(feed.updatedAt).toLocaleTimeString('en-CA',{hour:'numeric',minute:'2-digit'}):'not synced';
  caption.textContent=(data.status&&data.status.state==='connected'?'Your 30nama account':'Cached · reconnect needed')+' · Updated '+updated;
  heading.appendChild(title);heading.appendChild(caption);watching.appendChild(heading);
  var row=home.element('div','scroll-row');row.id='watching-row';watching.appendChild(row);feeds.appendChild(watching);feeds.appendChild($('popular'));
  (feed.items||[]).forEach(function(item){
    var b=home.button('','poster watching-poster',function(){watchingDetails(item);});b.id='watching-'+item.id;b.dataset.content='30nama:'+item.id;b.setAttribute('aria-label',item.title+' · '+episode(item));
    var enriched=rich(item,true),cardImage=enriched&&safeRichAsset(enriched.backdrop)?enriched.backdrop:item.image;
    if(cardImage&&(safeRichAsset(cardImage)||/^nama\/images\/30nama-\d+-[a-f0-9]{12}\.jpg$/.test(cardImage))){var img=home.element('img');img.alt='';img.src=cardImage;b.appendChild(img);}
    b.appendChild(home.element('span','poster-kind',episode(item)));b.appendChild(home.element('span','poster-name',item.title.replace(/\s+(19|20)\d{2}\s*$/,'')));
    b.appendChild(home.element('span','watching-time',item.seconds!==null?time(item.seconds)+' watched':'Ready to watch'));
    if(item.progress!==null){var track=home.element('span','watching-progress'),bar=home.element('span');bar.style.width=Math.max(0,Math.min(100,item.progress))+'%';track.appendChild(bar);b.appendChild(track);}
    b.addEventListener('focus',function(){showWatching(item);});row.appendChild(b);
  });
  if(!(feed.items||[]).length)watching.appendChild(home.element('p','watching-empty','Connect 30nama to see your watching list.'));
  [].forEach.call($('popular-row').querySelectorAll('button'),function(b){
    var item=popularItems.filter(function(a){return b.dataset.content===a.type+':'+a.id;})[0];
    b.addEventListener('focus',function(){source='popular';selected=null;$('hero-details').innerHTML=originalHeroButton;if(item)decorateFeatured(item,false);});
  });
  $('hero-details').activate=function(){if(source==='continue')watchingDetails(selected);else home.showTitle(home.featured());};
  window.NAMA_ON_TITLE=function(item){
    var match=(data.matches||{})[item.type+':'+item.id],direct=match&&match.id&&match.canStream,url=direct?'https://30nama.com/play/'+match.id:'https://30nama.com/search?q='+encodeURIComponent(item.title);
    var b=home.button(direct?'Open in 30nama':'Search 30nama','dialog-button',function(){openSite(url);});
    $('dialog-actions').insertBefore(b,$('dialog-actions').firstChild);home.focus(b);
    var meta=rich(item,false);if(meta){$('dialog-copy').textContent=detailsCopy(item,meta);if(meta.trailer){var trailer=home.button(meta.trailer.type==='Teaser'?'Watch teaser':'Watch trailer','dialog-button',function(){watchTrailer(meta);});$('dialog-actions').insertBefore(trailer,b.nextSibling);}}
  };

  function sizeSheet(){sheet.style.height=Math.max(1080,feeds.offsetTop+feeds.offsetHeight+100)+'px';}
  var scrollFrame=null,scrollTarget=null,firstVisibleRow=0,lastWheelAt=0;
  function stopScroll(){if(scrollFrame!==null)cancelAnimationFrame(scrollFrame);scrollFrame=null;scrollTarget=null;}
  function glideTo(value,immediate){
    var target=Math.max(0,Math.min(scroller.scrollHeight-scroller.clientHeight,value));
    if(scrollFrame!==null&&Math.abs(target-scrollTarget)<.5)return;
    stopScroll();
    if(immediate||window.matchMedia('(prefers-reduced-motion: reduce)').matches||Math.abs(scroller.scrollTop-target)<1){scroller.scrollTop=target;return;}
    var from=scroller.scrollTop,start=performance.now(),duration=240;scrollTarget=target;
    function step(now){var p=Math.min(1,(now-start)/duration),eased=1-Math.pow(1-p,3);scroller.scrollTop=from+(target-from)*eased;if(p<1)scrollFrame=requestAnimationFrame(step);else{scroller.scrollTop=target;scrollFrame=null;scrollTarget=null;}}
    scrollFrame=requestAnimationFrame(step);
  }
  function allRows(){return [$('grid')].concat([].slice.call(feeds.querySelectorAll('.scroll-row')));}
  function rowHeading(row){var section=row.id==='grid'?$('content'):row.closest('section');return section.querySelector('h1,h2');}
  function revealPair(index){
    var rows=allRows();
    if(index<firstVisibleRow)firstVisibleRow=index;
    else if(index>firstVisibleRow+1)firstVisibleRow=index-1;
    firstVisibleRow=Math.max(0,Math.min(Math.max(0,rows.length-2),firstVisibleRow));
    var bounds=scroller.getBoundingClientRect(),scale=bounds.width/1920,heading=rowHeading(rows[firstVisibleRow]);
    var desired=firstVisibleRow===0?0:scroller.scrollTop+(heading.getBoundingClientRect().top-bounds.top)/scale-4;
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
  window.NAMA_MOVE=function(code){
    if(code<37||code>40||!stage.classList.contains('home-page')||!$('dialog-backdrop').hidden)return false;
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
  scroller.addEventListener('scroll',function(){stage.classList.toggle('browse-scrolled',scroller.scrollTop>8);},{passive:true});
  scroller.addEventListener('wheel',function(e){
    if(!stage.classList.contains('home-page')||Math.abs(e.deltaY)<=Math.abs(e.deltaX))return;
    e.preventDefault();keyboardNavigation=true;
    var now=performance.now();if(scrollFrame!==null||now-lastWheelAt<280)return;lastWheelAt=now;
    var rows=allRows(),next=Math.max(0,Math.min(rows.length-2,firstVisibleRow+(e.deltaY>0?1:-1)));
    if(next===firstVisibleRow)return;
    var row=rows[e.deltaY>0?next+1:next],button=row.querySelector('button');if(button)home.focus(button);
  },{passive:false});
  var wasHome=stage.classList.contains('home-page');
  new MutationObserver(function(){var isHome=stage.classList.contains('home-page');if(isHome!==wasHome){wasHome=isHome;firstVisibleRow=0;glideTo(0,true);sizeSheet();}}).observe(stage,{attributes:true,attributeFilter:['class']});
  window.addEventListener('resize',sizeSheet);if(window.ResizeObserver)new ResizeObserver(sizeSheet).observe(feeds);sizeSheet();

  var browserArtwork='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 112 112" class="app-icon browser-artwork" aria-hidden="true"><defs><linearGradient id="browser-surface" x2="1" y2="1"><stop stop-color="#3875b8"/><stop offset="1" stop-color="#123d62"/></linearGradient></defs><rect width="112" height="112" rx="22" fill="url(#browser-surface)"/><rect x="17" y="23" width="78" height="66" rx="10" fill="#0b2138" fill-opacity=".22" stroke="#e9f6ff" stroke-width="3"/><path d="M18 40h76" stroke="#e9f6ff" stroke-opacity=".65" stroke-width="2"/><circle cx="26" cy="32" r="2" fill="#e9f6ff"/><circle cx="33" cy="32" r="2" fill="#e9f6ff"/><path d="M47 32h33" stroke="#e9f6ff" stroke-opacity=".6" stroke-width="3" stroke-linecap="round"/><circle cx="56" cy="64" r="17" fill="#e9f6ff" fill-opacity=".09" stroke="#e9f6ff" stroke-opacity=".85" stroke-width="2"/><path d="m65 53-5 16-13 7 5-16Z" fill="#e9f6ff"/><path d="m65 53-13 7 8 9Z" fill="#7edcfa"/><circle cx="56" cy="64" r="2" fill="#123d62"/></svg>';
  function refreshBrowserIcon(){
    var tile=$('grid').querySelector('[data-app="com.webos.app.browser"]'),old=tile&&tile.querySelector('img.app-icon');
    if(!old)return;var holder=home.element('span');holder.innerHTML=browserArtwork;old.parentNode.replaceChild(holder.firstElementChild,old);
  }
  new MutationObserver(refreshBrowserIcon).observe($('grid'),{childList:true});refreshBrowserIcon();

  function watchingAbout(){home.dialog('30nama continue watching','Your watching list, current episode, and progress come from your connected 30nama account and are cached privately on this Mac. Title logos, backdrops, cast, trailers, and episode information come from TMDB, matched by IMDb ID. Episode summaries appear only when requested.\n\nThe Mac checks for updates every 15 minutes. Resume opens 30nama; trailers open YouTube. No trailer plays automatically. Reconnection is required if 30nama rejects the saved session; automatic renewal has not been established.',[]);$('dialog-credit').hidden=false;}
  var oldInfo=$('feed-info'),info=home.button('30nama · TMDB','footer-button',function(){home.dialog('About your Home','Your watching list and today\'s popular titles, in separate rows.',[{label:'About 30nama continue watching',run:watchingAbout},{label:'About Popular today',run:function(){window.NAMA_ABOUT_POPULAR();}}]);});
  info.id='feed-info';oldInfo.parentNode.replaceChild(info,oldInfo);
  document.querySelector('footer > span').textContent='Up / Down for rows · Left / Right for titles · OK to open';
  window.NAMA_ABOUT_POPULAR=function(){home.dialog('Popular today','Worldwide daily trending movies and shows from TMDB. Your separate 30nama continue watching row reads your connected account.\n\n30nama links are matched by title, year, and type. Ambiguous or unavailable titles use Search 30nama. Playback on the C1 is not yet tested.',[]);$('dialog-credit').hidden=false;};
  var badge=home.element('div','preview-badge','MAC PREVIEW · TV unchanged');stage.appendChild(badge);
  if(feed.items&&feed.items.length)showWatching(feed.items[0]);
})();
