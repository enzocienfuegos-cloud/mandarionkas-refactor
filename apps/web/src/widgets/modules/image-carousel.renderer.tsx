import { useEffect, useMemo, useState } from 'react';
import type { WidgetNode } from '../../domain/document/types';
import type { RenderContext } from '../../canvas/stage/render-context';
import { clamp, getAccent, moduleBody, moduleHeader, moduleShell, parseCarouselSlides, renderCollapsedIfNeeded } from './shared-styles';
import { resolveCornerRadius } from '../shared/corner-style';
function ImageCarouselModuleRenderer({ node, ctx }: { node: WidgetNode; ctx: RenderContext }): JSX.Element {
  const accent = getAccent(node);
  const borderRadius = resolveCornerRadius(node, 20);
  const slides = useMemo(() => parseCarouselSlides(String(node.props.slides ?? '')), [node.props.slides]);
  const intervalMs = clamp(Number(node.props.intervalMs ?? 2600), 1000, 10000);
  const autoplay = Boolean(node.props.autoplay ?? true);
  const showPrevButton = Boolean(node.props.showPrevButton ?? true);
  const showNextButton = Boolean(node.props.showNextButton ?? true);
  const showPaginationDots = Boolean(node.props.showPaginationDots ?? true);
  const paginationDotSize = clamp(Number(node.props.paginationDotSize ?? 6), 3, 10);
  const [activeIndex, setActiveIndex] = useState(0);
  useEffect(() => {
    if (!autoplay || slides.length <= 1 || !ctx.previewMode) return;
    const timer = window.setInterval(() => setActiveIndex((value) => (value + 1) % slides.length), intervalMs);
    return () => window.clearInterval(timer);
  }, [autoplay, slides.length, intervalMs, ctx.previewMode]);
  const activeSlide = slides[activeIndex] ?? slides[0];

  return <div style={moduleShell(node, ctx)}><div style={moduleHeader(node)}>{String(node.props.title ?? node.name)}</div><div style={moduleBody}><div style={{ position:'relative', flex:1, borderRadius, overflow:'hidden', background:'#111827' }}>{activeSlide ? <img src={activeSlide.src} alt={activeSlide.caption} style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }} /> : <div style={{ width:'100%', height:'100%', display:'grid', placeItems:'center', opacity:.7 }}>Add slides</div>}<div style={{ position:'absolute', insetInline:12, bottom:10, display:'flex', justifyContent:'space-between', alignItems:'end', gap:8 }}><div style={{ borderRadius:10, padding:'8px 10px', background:'rgba(15,23,42,.68)', fontSize:12 }}>{activeSlide?.caption ?? 'No slide'}</div>{showPaginationDots ? <div style={{ display:'flex', gap:6 }}>{slides.map((_, index) => <button key={index} type="button" onClick={(event)=>{ event.stopPropagation(); setActiveIndex(index); }} style={{ width:paginationDotSize, height:paginationDotSize, borderRadius:'50%', border:'none', background:index===activeIndex ? accent : 'rgba(255,255,255,.45)', cursor:'pointer' }} />)}</div> : null}</div></div>{showPrevButton || showNextButton ? <div style={{ display:'flex', gap:8 }}>{showPrevButton ? <button type="button" onClick={(event)=>{ event.stopPropagation(); setActiveIndex((value)=> slides.length ? (value - 1 + slides.length) % slides.length : 0); }} style={{ flex:1, borderRadius:10, border:`1px solid ${accent}`, background:'transparent', color:'inherit', padding:'8px 10px' }}>Prev</button> : null}{showNextButton ? <button type="button" onClick={(event)=>{ event.stopPropagation(); setActiveIndex((value)=> slides.length ? (value + 1) % slides.length : 0); ctx.triggerWidgetAction('click'); }} style={{ flex:1, borderRadius:10, border:'none', background:accent, color:'#111827', fontWeight:800, padding:'8px 10px' }}>Next</button> : null}</div> : null}</div></div>;
}
export function renderImageCarouselStage(node: WidgetNode, ctx: RenderContext): JSX.Element { const collapsed=renderCollapsedIfNeeded(node,ctx); if(collapsed) return collapsed; return <ImageCarouselModuleRenderer node={node} ctx={ctx}/>; }
