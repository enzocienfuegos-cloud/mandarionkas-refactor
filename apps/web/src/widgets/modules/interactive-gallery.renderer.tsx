import { useState } from 'react';
import type { WidgetNode } from '../../domain/document/types';
import type { RenderContext } from '../../canvas/stage/render-context';
import { clamp, getAccent, moduleBody, moduleHeader, moduleShell, parseCarouselSlides, renderCollapsedIfNeeded } from './shared-styles';
import { resolveCornerRadius } from '../shared/corner-style';
function InteractiveGalleryModuleRenderer({ node, ctx }: { node: WidgetNode; ctx: RenderContext }): JSX.Element {
  const accent = getAccent(node);
  const borderRadius = resolveCornerRadius(node, 20);
  const slides = parseCarouselSlides(String(node.props.slides ?? ''));
  const itemCount = Math.max(1, slides.length || clamp(Number(node.props.itemCount ?? 4), 1, 12));
  const showPrevButton = Boolean(node.props.showPrevButton ?? true);
  const showNextButton = Boolean(node.props.showNextButton ?? true);
  const showPaginationDots = Boolean(node.props.showPaginationDots ?? true);
  const paginationDotSize = clamp(Number(node.props.paginationDotSize ?? 6), 3, 10);
  const [activeIndex, setActiveIndex] = useState(clamp(Number(node.props.activeIndex ?? 1), 1, itemCount) - 1);
  const activeSlide = slides[activeIndex] ?? slides[0];
  return <div style={moduleShell(node, ctx)}><div style={moduleHeader(node)}>{String(node.props.title ?? node.name)}</div><div style={moduleBody}><div style={{ flex: 1, borderRadius, overflow:'hidden', background: activeSlide ? '#111827' : `linear-gradient(135deg, ${accent}55, rgba(255,255,255,.08))`, display: 'grid', placeItems: 'center', fontSize: 26, fontWeight: 900, position:'relative' }}>{activeSlide ? <img src={activeSlide.src} alt={activeSlide.caption} style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }} /> : `${activeIndex + 1} / ${itemCount}`}{activeSlide ? <div style={{ position:'absolute', left:12, right:12, bottom:12, display:'flex', justifyContent:'space-between', alignItems:'end', gap:8 }}><div style={{ borderRadius:10, padding:'8px 10px', background:'rgba(15,23,42,.68)', fontSize:12, color:'#fff' }}>{activeSlide.caption || `Image ${activeIndex + 1}`}</div><div style={{ display:'flex', alignItems:'center', gap:8 }}>{showPaginationDots ? <div style={{ display:'flex', gap:6 }}>{Array.from({ length: itemCount }, (_, index) => <button key={index} type="button" onClick={(event)=>{ event.stopPropagation(); setActiveIndex(index); }} style={{ width:paginationDotSize, height:paginationDotSize, borderRadius:'50%', border:'none', background:index===activeIndex ? accent : 'rgba(255,255,255,.4)', cursor:'pointer' }} />)}</div> : null}<div style={{ borderRadius:999, padding:'4px 8px', background:'rgba(15,23,42,.68)', fontSize:12, color:'#fff' }}>{activeIndex + 1} / {itemCount}</div></div></div> : null}</div>{showPrevButton || showNextButton ? <div style={{ display: 'flex', gap: 8 }}>{showPrevButton ? <button type="button" onClick={(event) => { event.stopPropagation(); setActiveIndex((value) => (value - 1 + itemCount) % itemCount); }} style={{ flex: 1, borderRadius: 10, border: `1px solid ${accent}`, background: 'transparent', color: 'inherit', padding: '8px 10px' }}>Prev</button> : null}{showNextButton ? <button type="button" onClick={(event) => { event.stopPropagation(); setActiveIndex((value) => (value + 1) % itemCount); ctx.triggerWidgetAction('click'); }} style={{ flex: 1, borderRadius: 10, border: 'none', background: accent, color: '#111827', padding: '8px 10px', fontWeight: 800 }}>Next</button> : null}</div> : null}</div></div>;
}
export function renderInteractiveGalleryStage(node: WidgetNode, ctx: RenderContext): JSX.Element { const collapsed=renderCollapsedIfNeeded(node,ctx); if(collapsed) return collapsed; return <InteractiveGalleryModuleRenderer node={node} ctx={ctx}/>; }
