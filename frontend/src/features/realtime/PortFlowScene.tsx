import { useEffect, useRef, useState } from "react";
import {
  AmbientLight,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CatmullRomCurve3,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  GridHelper,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Points,
  PointsMaterial,
  Raycaster,
  RingGeometry,
  Scene,
  TubeGeometry,
  Vector2,
  Vector3,
  WebGLRenderer,
} from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { PortStatus } from "./types";
import styles from "./PortFlowScene.module.css";

const routeRows = [-2.15, -0.72, 0.72, 2.15];

type Pressure = "smooth" | "busy" | "crowded";

function pressure(wait: number): Pressure {
  return wait >= 35 ? "crowded" : wait >= 18 ? "busy" : "smooth";
}

function pressureLabel(wait: number): string {
  return wait >= 35 ? "拥挤" : wait >= 18 ? "较繁忙" : "畅通";
}

function pressureColor(wait: number): number {
  return wait >= 35 ? 0xff665f : wait >= 18 ? 0xf4b84d : 0x4bdd9d;
}

type SceneController = { focus: (portId: string | null) => void };

export function PortFlowScene({ ports }: { ports: PortStatus[] }) {
  const host = useRef<HTMLDivElement>(null);
  const controller = useRef<SceneController | null>(null);
  const [available, setAvailable] = useState(true);
  const [selectedPortId, setSelectedPortId] = useState<string | null>(null);

  function focus(portId: string | null) {
    setSelectedPortId(portId);
    controller.current?.focus(portId);
  }

  useEffect(() => {
    if (!host.current) return;
    const container = host.current;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let renderer: WebGLRenderer;
    try {
      renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    } catch {
      setAvailable(false);
      return;
    }

    setAvailable(true);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.7));
    renderer.setClearColor(0x061f25, 0);
    renderer.domElement.setAttribute("aria-hidden", "true");
    container.appendChild(renderer.domElement);

    const scene = new Scene();
    const camera = new PerspectiveCamera(38, 1, 0.1, 80);
    camera.position.set(0, 7.8, 11.6);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.075;
    controls.enablePan = false;
    controls.minDistance = 8;
    controls.maxDistance = 18;
    controls.minPolarAngle = 0.55;
    controls.maxPolarAngle = 1.32;
    controls.minAzimuthAngle = -0.72;
    controls.maxAzimuthAngle = 0.72;
    controls.target.set(0, 0, 0);

    scene.add(new AmbientLight(0xb9e9df, 1.45));
    const keyLight = new DirectionalLight(0xffffff, 2.2);
    keyLight.position.set(-2, 9, 7);
    scene.add(keyLight);

    const water = new Mesh(
      new PlaneGeometry(14.4, 8.2),
      new MeshStandardMaterial({ color: 0x082e36, metalness: 0.05, roughness: 0.72, transparent: true, opacity: 0.84, side: DoubleSide }),
    );
    water.rotation.x = -Math.PI / 2;
    water.position.y = -0.96;
    scene.add(water);

    const platformGeometry = new BoxGeometry(4.7, 0.32, 6.5);
    const hongKong = new Mesh(platformGeometry, new MeshStandardMaterial({ color: 0x104f4c, metalness: 0.12, roughness: 0.65 }));
    hongKong.position.set(-4.45, -0.73, 0);
    scene.add(hongKong);
    const shenzhen = new Mesh(platformGeometry.clone(), new MeshStandardMaterial({ color: 0x163f58, metalness: 0.12, roughness: 0.65 }));
    shenzhen.position.set(4.45, -0.73, 0);
    scene.add(shenzhen);

    [-4.45, 4.45].forEach((x, index) => {
      const grid = new GridHelper(6.1, 8, index === 0 ? 0x51bda7 : 0x4b8eaf, 0x1b5558);
      grid.position.set(x, -0.55, 0);
      scene.add(grid);
    });

    const borderLine = new Mesh(
      new BoxGeometry(0.12, 0.03, 6.8),
      new MeshBasicMaterial({ color: 0x8ab6b0, transparent: true, opacity: 0.38 }),
    );
    borderLine.position.set(0, -0.43, 0);
    scene.add(borderLine);

    const routeVisuals: Array<{
      id: string;
      row: number;
      curve: CatmullRomCurve3;
      core: Mesh<TubeGeometry, MeshBasicMaterial>;
      glow: Mesh<TubeGeometry, MeshBasicMaterial>;
      particles: Points<BufferGeometry, PointsMaterial>;
      offsets: number[];
      speed: number;
      color: number;
    }> = [];
    const clickableRoutes: Mesh[] = [];

    ports.forEach((port, index) => {
      const row = routeRows[index] ?? 0;
      const wait = Math.min(60, port.current_wait);
      const color = pressureColor(wait);
      const curve = new CatmullRomCurve3([
        new Vector3(-3.1, -0.2, row),
        new Vector3(-1.65, 0.14 + wait / 260, row * 1.04),
        new Vector3(0, 0.45 + wait / 180, row),
        new Vector3(1.65, 0.14 + wait / 260, row * 1.04),
        new Vector3(3.1, -0.2, row),
      ]);
      const radius = 0.045 + wait / 650;
      const glowMaterial = new MeshBasicMaterial({ color, transparent: true, opacity: 0.18 });
      const coreMaterial = new MeshBasicMaterial({ color, transparent: true, opacity: 0.94 });
      const glow = new Mesh(new TubeGeometry(curve, 72, radius * 2.8, 10, false), glowMaterial);
      const core = new Mesh(new TubeGeometry(curve, 72, radius, 10, false), coreMaterial);
      core.userData.portId = port.id;
      glow.userData.portId = port.id;
      scene.add(glow, core);
      clickableRoutes.push(core, glow);

      const countPerDirection = 10 + Math.round(wait / 4);
      const positions = new Float32Array(countPerDirection * 2 * 3);
      const geometry = new BufferGeometry();
      geometry.setAttribute("position", new BufferAttribute(positions, 3));
      const particles = new Points(
        geometry,
        new PointsMaterial({ color: 0xffffff, size: 0.09 + wait / 1100, transparent: true, opacity: 0.92, depthWrite: false }),
      );
      scene.add(particles);

      [-3.1, 0, 3.1].forEach((x, nodeIndex) => {
        const node = new Mesh(
          nodeIndex === 1 ? new RingGeometry(0.13, 0.25, 28) : new CylinderGeometry(0.11, 0.11, 0.16, 20),
          new MeshBasicMaterial({ color, side: DoubleSide, transparent: true, opacity: 0.96 }),
        );
        if (nodeIndex === 1) node.rotation.x = -Math.PI / 2;
        node.position.set(x, nodeIndex === 1 ? -0.38 : -0.46, row);
        scene.add(node);
      });

      routeVisuals.push({
        id: port.id,
        row,
        curve,
        core,
        glow,
        particles,
        offsets: Array.from({ length: countPerDirection }, (_item, itemIndex) => itemIndex / countPerDirection),
        speed: 0.105 + Math.max(0, 42 - wait) / 320,
        color,
      });
    });

    function applyFocus(portId: string | null) {
      routeVisuals.forEach((visual) => {
        const active = !portId || visual.id === portId;
        visual.core.material.opacity = active ? 0.96 : 0.18;
        visual.glow.material.opacity = active ? (portId ? 0.34 : 0.18) : 0.035;
        visual.particles.material.opacity = active ? 0.94 : 0.1;
        visual.particles.material.size = active && portId ? 0.145 : 0.1;
      });
      const route = routeVisuals.find((visual) => visual.id === portId);
      controls.target.set(0, 0, route?.row ?? 0);
    }
    controller.current = { focus: applyFocus };
    applyFocus(selectedPortId);

    const raycaster = new Raycaster();
    const pointer = new Vector2();
    let pointerStart: { x: number; y: number } | null = null;
    const handlePointerDown = (event: PointerEvent) => { pointerStart = { x: event.clientX, y: event.clientY }; };
    const handlePointerUp = (event: PointerEvent) => {
      if (!pointerStart || Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y) > 6) return;
      const bounds = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
      pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(clickableRoutes, false)[0];
      if (hit) focus(String(hit.object.userData.portId));
    };
    renderer.domElement.addEventListener("pointerdown", handlePointerDown);
    renderer.domElement.addEventListener("pointerup", handlePointerUp);

    const resize = () => {
      const width = Math.max(320, container.clientWidth);
      const height = Math.max(360, container.clientHeight);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    resize();

    let frame = 0;
    const started = performance.now();
    const render = (time: number) => {
      routeVisuals.forEach((route) => {
        const attribute = route.particles.geometry.getAttribute("position") as BufferAttribute;
        route.offsets.forEach((offset, particleIndex) => {
          const movement = reducedMotion ? 0 : (time - started) * 0.001 * route.speed;
          const forward = (offset + movement) % 1;
          const reverse = 1 - ((offset + movement * 0.72 + 0.16) % 1);
          const pointForward = route.curve.getPoint(forward);
          const pointReverse = route.curve.getPoint(reverse);
          attribute.setXYZ(particleIndex, pointForward.x, pointForward.y, pointForward.z);
          attribute.setXYZ(route.offsets.length + particleIndex, pointReverse.x, pointReverse.y + 0.035, pointReverse.z);
        });
        attribute.needsUpdate = true;
      });
      controls.update();
      renderer.render(scene, camera);
      frame = requestAnimationFrame(render);
    };
    render(started);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      controls.dispose();
      renderer.domElement.removeEventListener("pointerdown", handlePointerDown);
      renderer.domElement.removeEventListener("pointerup", handlePointerUp);
      scene.traverse((object) => {
        const resource = object as Mesh;
        resource.geometry?.dispose();
        const material = resource.material;
        if (Array.isArray(material)) material.forEach((item) => item.dispose());
        else material?.dispose();
      });
      renderer.dispose();
      renderer.domElement.remove();
      controller.current = null;
    };
  }, [ports]);

  return (
    <section className={styles.panel} aria-labelledby="flow-title">
      <header className={styles.heading}>
        <div>
          <span className="sectionKicker">Interactive Three.js border flow</span>
          <h2 id="flow-title">香港—深圳四口岸实时流线</h2>
          <p>拖动旋转、滚轮缩放；点击流线或下方口岸即可聚焦。路线颜色、粗细和粒子密度共同表示当前等待压力。</p>
        </div>
        <div className={styles.pressureLegend} aria-label="等待压力图例">
          <span><i className={styles.smooth} />畅通 &lt;18 分</span>
          <span><i className={styles.busy} />较繁忙 18–34 分</span>
          <span><i className={styles.crowded} />拥挤 ≥35 分</span>
        </div>
      </header>

      <div className={styles.visual}>
        <div className={`${styles.region} ${styles.hongKong}`}><b>香港</b><span>HONG KONG</span></div>
        <div className={`${styles.region} ${styles.shenzhen}`}><b>深圳</b><span>SHENZHEN</span></div>
        <div
          className={styles.scene}
          ref={host}
          role="img"
          aria-label={`香港与深圳之间四条口岸流线。${ports.map((port) => `${port.name}口岸${pressureLabel(port.current_wait)}，等待${port.current_wait}分钟`).join("；")}`}
        >
          {!available && (
            <div className={styles.fallback}>
              <strong>当前浏览器未启用 3D 图形</strong>
              <p>你仍可通过下方口岸列表查看全部实时压力数据。</p>
            </div>
          )}
        </div>
        <span className={styles.borderLabel}>深港边界 / BORDER</span>
      </div>

      <div className={styles.routes} aria-label="四口岸压力数据与路线聚焦控制">
        {ports.map((port, index) => {
          const level = pressure(port.current_wait);
          const selected = selectedPortId === port.id;
          return (
            <button
              type="button"
              aria-pressed={selected}
              className={`${styles.routeButton} ${selected ? styles.selected : ""}`}
              onClick={() => focus(selected ? null : port.id)}
              key={port.id}
            >
              <span className={`${styles.routeIndex} ${styles[level]}`}>{String(index + 1).padStart(2, "0")}</span>
              <span><b>{port.name}口岸</b><small>{pressureLabel(port.current_wait)} · 未来 1h {port.change_next_hour > 0 ? "+" : ""}{port.change_next_hour} 分</small></span>
              <strong>{port.current_wait}<small>分钟</small></strong>
            </button>
          );
        })}
      </div>
      <small className={styles.notice}>3D 流线为离线演示态势，不代表真实旅客轨迹、地理比例或导航路线。</small>
    </section>
  );
}
