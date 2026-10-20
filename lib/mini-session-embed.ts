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

  return `<iframe src="${embedUrl}" title="${safeTitle}" data-spetly-embed style="display:block;width:100%;max-width:720px;height:860px;border:0;border-radius:12px;overflow:hidden;background:transparent;" scrolling="no" loading="lazy"></iframe><script>(function(){function requestHeight(frame){if(frame&&frame.contentWindow){frame.contentWindow.postMessage({type:"spetly:request-embed-height"},"*");}}if(!window.__spetlyEmbedAutoResize){window.__spetlyEmbedAutoResize=true;window.addEventListener("message",function(event){var data=event.data;if(!data||data.type!=="spetly:embed-height"||typeof data.height!=="number"||!Number.isFinite(data.height))return;var frames=document.querySelectorAll("iframe[data-spetly-embed]");for(var i=0;i<frames.length;i+=1){if(frames[i].contentWindow===event.source){frames[i].style.height=Math.max(480,Math.min(6000,Math.ceil(data.height)))+"px";break;}}});}var frames=document.querySelectorAll("iframe[data-spetly-embed]");for(var i=0;i<frames.length;i+=1){if(frames[i].dataset.spetlyResizeReady)continue;frames[i].dataset.spetlyResizeReady="true";frames[i].setAttribute("scrolling","no");frames[i].addEventListener("load",function(){requestHeight(this);});requestHeight(frames[i]);}})();</script>`;
}
