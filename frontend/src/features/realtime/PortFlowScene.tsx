import { useEffect, useRef, useState } from "react";
import { BufferAttribute, BufferGeometry, CatmullRomCurve3, CircleGeometry, DoubleSide, GridHelper, Mesh, MeshBasicMaterial, PerspectiveCamera, Points, PointsMaterial, RingGeometry, Scene, TubeGeometry, Vector3, WebGLRenderer } from "three";
import type { PortStatus } from "./types";
import styles from "./PortFlowScene.module.css";

const routeTargets = [
  new Vector3(-3.6, 1.25, 0),
  new Vector3(-1.25, 1.8, .25),
  new Vector3(1.2, 1.55, -.15),
  new Vector3(3.7, .95, .1),
];

function pressureColor(wait: number): number {
  return wait >= 35 ? 0xef6b61 : wait >= 18 ? 0xf2b34b : 0x55d6a1;
}

export function PortFlowScene({ ports }: { ports: PortStatus[] }) {
  const host = useRef<HTMLDivElement>(null);
  const [available, setAvailable] = useState(true);
  useEffect(() => {
    if (!host.current) return;
    const container = host.current;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let renderer: WebGLRenderer;
    try {
      renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
    } catch {
      setAvailable(false);
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);
    const scene = new Scene();
    const camera = new PerspectiveCamera(40, 1, .1, 100);
    camera.position.set(0, 0, 11);
    const routeObjects: Array<{ curve: CatmullRomCurve3; points: Points; offsets: number[]; speed: number }> = [];
    const origin = new Vector3(0, -2.4, 0);

    const grid = new GridHelper(12, 12, 0x2c6d64, 0x184c46);
    grid.rotation.x = Math.PI / 2;
    grid.position.z = -1.2;
    scene.add(grid);
    ports.forEach((port, index) => {
      const target = routeTargets[index];
      const curve = new CatmullRomCurve3([
        origin.clone().add(new Vector3((index - 1.5) * .22, 0, 0)),
        new Vector3((target.x + origin.x) * .32, -.45, (index - 1.5) * .28),
        new Vector3(target.x * .72, .45, (1.5 - index) * .18),
        target,
      ]);
      const color = pressureColor(port.current_wait);
      const thickness = .035 + Math.min(port.current_wait, 60) / 900;
      const tube = new Mesh(
        new TubeGeometry(curve, 60, thickness, 8, false),
        new MeshBasicMaterial({ color, transparent: true, opacity: .72 }),
      );
      scene.add(tube);
      const count = 12 + Math.round(Math.min(port.current_wait, 48) / 4);
      const positions = new Float32Array(count * 3);
      const geometry = new BufferGeometry();
      geometry.setAttribute("position", new BufferAttribute(positions, 3));
      const points = new Points(
        geometry,
        new PointsMaterial({ color: 0xffffff, size: .075, transparent: true, opacity: .9 }),
      );
      scene.add(points);
      routeObjects.push({ curve, points, offsets: Array.from({ length: count }, (_item, itemIndex) => itemIndex / count), speed: .09 + Math.max(0, 40 - port.current_wait) / 260 });
    });
    const hub = new Mesh(new CircleGeometry(.22, 24), new MeshBasicMaterial({ color: 0xc9f36b }));
    hub.position.copy(origin); scene.add(hub);
    routeTargets.forEach((target, index) => { const node = new Mesh(new RingGeometry(.12, .22, 24), new MeshBasicMaterial({ color: pressureColor(ports[index]?.current_wait ?? 0), side: DoubleSide })); node.position.copy(target); scene.add(node); });

    const resize = () => {
      const width = Math.max(320, container.clientWidth);
      const height = Math.max(260, container.clientHeight);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize); observer.observe(container); resize();
    let frame = 0;
    const started = performance.now();
    const render = (time: number) => {
      routeObjects.forEach((route) => {
        const attribute = route.points.geometry.getAttribute("position") as BufferAttribute;
        route.offsets.forEach((offset, index) => {
          const progress = reducedMotion ? offset : (offset + (time - started) * .001 * route.speed) % 1;
          const point = route.curve.getPoint(progress);
          attribute.setXYZ(index, point.x, point.y, point.z);
        });
        attribute.needsUpdate = true;
      });
      renderer.render(scene, camera);
      if (!reducedMotion) frame = requestAnimationFrame(render);
    };
    render(started);
    return () => {
      cancelAnimationFrame(frame); observer.disconnect();
      scene.traverse((object) => { if (object instanceof Mesh || object instanceof Points) { object.geometry.dispose(); const material = object.material; if (Array.isArray(material)) material.forEach((item) => item.dispose()); else material.dispose(); } });
      renderer.dispose(); renderer.domElement.remove();
    };
  }, [ports]);
  return (
    <section className={styles.panel} aria-labelledby="flow-title">
      <div className={styles.copy}><span className="sectionKicker">Three.js live flow</span><h2 id="flow-title">四条过关路线流动压力</h2><p>粒子密度、路线粗细与颜色映射当前等待压力；流动速度只用于课堂态势表达。</p><div className={styles.stats}>{ports.map((port) => <span key={port.id}><i style={{ background: `#${pressureColor(port.current_wait).toString(16)}` }} /><b>{port.name}</b>{port.current_wait}分</span>)}</div></div>
      <div className={styles.scene} ref={host}>{!available && <div className={styles.fallback}>当前浏览器未启用 WebGL，已保留2D口岸地图。</div>}</div>
      <small>3D 动画为示意，不代表真实旅客轨迹或地理路线。</small>
    </section>
  );
}
