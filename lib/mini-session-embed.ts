import { miniSessionEmbedUrl } from "@/lib/email";

function escapeHtmlAttribute(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function miniSessionEmbedCode(slug: string, title: string, publicSubdomain?: string | null) {
  const embedUrl = escapeHtmlAttribute(miniSessionEmbedUrl(slug, publicSubdomain));
  const safeTitle = escapeHtmlAttribute(`${title} időpontfoglaló`);

  return `<iframe src="${embedUrl}" title="${safeTitle}" data-spetly-embed style="display:block;width:100%;max-width:720px;height:860px;border:0;border-radius:12px;overflow:hidden;background:transparent;" scrolling="no" loading="lazy"></iframe><script>(function(){function requestHeight(frame){if(frame&&frame.contentWindow){frame.contentWindow.postMessage({type:"spetly:request-embed-height"},"*");}}function findFrame(source){var frames=document.querySelectorAll("iframe[data-spetly-embed]");for(var i=0;i<frames.length;i+=1){if(frames[i].contentWindow===source)return frames[i];}return null;}function scrollParent(data){var deltaX=Number(data.deltaX)||0;var deltaY=Number(data.deltaY)||0;var mode=Number(data.deltaMode)||0;var scale=mode===1?16:mode===2?window.innerHeight:1;var scrollingElement=document.scrollingElement||document.documentElement;var previousBehavior=scrollingElement.style.scrollBehavior;scrollingElement.style.scrollBehavior="auto";scrollingElement.scrollLeft+=deltaX*scale;scrollingElement.scrollTop+=deltaY*scale;scrollingElement.style.scrollBehavior=previousBehavior;}if(!window.__spetlyEmbedBridge){window.__spetlyEmbedBridge=true;window.__spetlyEmbedAutoResize=true;window.addEventListener("message",function(event){var data=event.data;if(!data)return;var frame=findFrame(event.source);if(!frame)return;if(data.type==="spetly:embed-height"&&typeof data.height==="number"&&Number.isFinite(data.height)){frame.style.height=Math.max(480,Math.min(6000,Math.ceil(data.height)))+"px";}else if(data.type==="spetly:embed-wheel"){scrollParent(data);}});}var frames=document.querySelectorAll("iframe[data-spetly-embed]");for(var i=0;i<frames.length;i+=1){if(frames[i].dataset.spetlyResizeReady)continue;frames[i].dataset.spetlyResizeReady="true";frames[i].setAttribute("scrolling","no");frames[i].addEventListener("load",function(){requestHeight(this);});requestHeight(frames[i]);}})();</script>`;
}
