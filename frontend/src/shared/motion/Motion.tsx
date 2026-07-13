import { type PropsWithChildren, useEffect, useRef, useState } from "react";
import styles from "./Motion.module.css";

export function useReducedMotion() {
  const [reduced, setReduced] = useState(() => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(query.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return reduced;
}

type FadeInProps = PropsWithChildren<{ delay?: number; duration?: number; className?: string }>;

export function FadeIn({ children, delay = 0, duration = 1000, className = "" }: FadeInProps) {
  const reduced = useReducedMotion();
  const [visible, setVisible] = useState(reduced);
  useEffect(() => {
    if (reduced) { setVisible(true); return; }
    const timer = window.setTimeout(() => setVisible(true), delay);
    return () => window.clearTimeout(timer);
  }, [delay, reduced]);
  return <div className={`${styles.fadeIn} ${visible ? styles.visible : ""} ${className}`} style={{ transitionDuration: `${duration}ms` }}>{children}</div>;
}

export function AnimatedHeading({ text, className = "", delay = 200 }: { text: string; className?: string; delay?: number }) {
  const reduced = useReducedMotion();
  const [started, setStarted] = useState(reduced);
  useEffect(() => {
    if (reduced) { setStarted(true); return; }
    const timer = window.setTimeout(() => setStarted(true), delay);
    return () => window.clearTimeout(timer);
  }, [delay, reduced]);
  const lines = text.split("\n");
  return (
    <h1 className={className} aria-label={text.replace("\n", " ")}>
      {lines.map((line, lineIndex) => (
        <span className={styles.line} aria-hidden="true" key={`${line}-${lineIndex}`}>
          {[...line].map((character, characterIndex) => {
            const offset = lines.slice(0, lineIndex).reduce((total, item) => total + item.length, 0);
            const stagger = (offset + characterIndex) * 30;
            return <span className={`${styles.character} ${started ? styles.characterVisible : ""}`} style={{ transitionDelay: reduced ? "0ms" : `${stagger}ms` }} key={`${character}-${characterIndex}`}>{character === " " ? "\u00a0" : character}</span>;
          })}
        </span>
      ))}
    </h1>
  );
}

export function Reveal({ children, className = "", delay = 0 }: PropsWithChildren<{ className?: string; delay?: number }>) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const [visible, setVisible] = useState(reduced);
  useEffect(() => {
    if (reduced) { setVisible(true); return; }
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setVisible(true); observer.disconnect(); }
    }, { threshold: 0.12 });
    observer.observe(node);
    return () => observer.disconnect();
  }, [reduced]);
  return <div ref={ref} className={`${styles.reveal} ${visible ? styles.revealVisible : ""} ${className}`} style={{ transitionDelay: `${delay}ms` }}>{children}</div>;
}
