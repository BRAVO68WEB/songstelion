import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass";
import { FilmPass } from "three/examples/jsm/postprocessing/FilmPass";
import { TextGeometry } from "three/examples/jsm/geometries/TextGeometry";
import { Font, FontLoader } from "three/examples/jsm/loaders/FontLoader";
import { BufferGeometry, Vector3 } from "three";

const SONG_COUNT = 10;
const PARTICLE_COUNT = 300;
const CANVAS_SELECTOR = "canvas.webgl";
const FONT_URL = "font.json";
const API_URL = "https://api.b68.dev/me/spotify/top";

const fetchTrackData = async (): Promise<any> => {
  try {
    const response = await fetch(API_URL);
    return response.json();
  } catch (error) {
    console.error("Error fetching track data:", error);
    return null;
  }
};

const loadFont = async (loader: FontLoader, url: string): Promise<Font> => {
  return new Promise((resolve, reject) => {
    loader.load(url, resolve, undefined, reject);
  });
};

const createParticleGeometry = (count: number): BufferGeometry => {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count * 3; i++) {
    positions[i] = (Math.random() - 0.5) * 7;
  }
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  return geometry;
};

const createSongMeshes = (
  tracks: string[],
  font: Font,
  songMat: THREE.MeshStandardMaterial,
  textMat: THREE.MeshBasicMaterial
): {
  songMesh: THREE.Mesh[];
  textMesh: THREE.Mesh[];
  spherePos: number[][];
} => {
  const songMesh: THREE.Mesh[] = [];
  const textMesh: THREE.Mesh[] = [];
  const spherePos: number[][] = [];

  const getRandom = () => (Math.random() - 0.5) * 4;

  for (let i = 0; i < SONG_COUNT; i++) {
    spherePos.push([getRandom(), getRandom(), getRandom()]);
  }

  for (let i = 0; i < SONG_COUNT; i++) {
    const geo = new THREE.SphereGeometry(0.025, 32, 16);
    const textGeo = new TextGeometry(tracks[i], {
      size: 0.1,
      depth: 0.001,
      font: font,
      curveSegments: 4,
    });
    textGeo.computeBoundingBox();
    const size = new Vector3();
    textGeo.boundingBox?.getSize(size);
    textGeo.translate(-size.x / 2, -0.1, 0);

    const mesh = new THREE.Mesh(geo, songMat);
    const textMeshItem = new THREE.Mesh(textGeo, textMat);
    const randomPos = spherePos[i];
    mesh.position.set(randomPos[0], randomPos[1], randomPos[2]);
    textMeshItem.position.set(randomPos[0], randomPos[1], randomPos[2]);

    songMesh.push(mesh);
    textMesh.push(textMeshItem);
  }

  return { songMesh, textMesh, spherePos };
};

const createLines = (
  points: Vector3[],
  material: THREE.LineBasicMaterial
): THREE.Line[] => {
  const closest: number[] = [];
  for (const element of points) {
    let dMin = Infinity;
    let close = 0;
    for (let j = 0; j < points.length; j++) {
      const d = element.distanceTo(points[j]);
      if (d < dMin && d !== 0) {
        dMin = d;
        close = j;
      }
    }
    closest.push(close);
  }

  return points.map((_, i) => {
    const lineGeo = new THREE.BufferGeometry().setFromPoints([
      points[closest[i]],
      points[i],
    ]);
    return new THREE.Line(lineGeo, material);
  });
};

const renderFunc = async () => {
  const loader = new FontLoader();
  const canvas = document.querySelector(CANVAS_SELECTOR) as HTMLCanvasElement;
  const scene = new THREE.Scene();

  const fetchedTrackData = await fetchTrackData();
  if (!fetchedTrackData) return;

  const tracks = fetchedTrackData.data.items.map((item: any) => item.name);

  const particleGeo = createParticleGeometry(PARTICLE_COUNT);
  const particleGeoBright = createParticleGeometry(PARTICLE_COUNT);

  const material = new THREE.PointsMaterial({ size: 0.008, color: 0xffffff });
  const materialBright = new THREE.PointsMaterial({
    size: 0.008,
    color: 0xffffff,
  });

  const songMat = new THREE.MeshStandardMaterial({
    color: 0x000000,
    emissive: 0xffffff,
    emissiveIntensity: 1.2,
  });

  const textMat = new THREE.MeshBasicMaterial({ color: 0x878686 });

  let font: Font;
  try {
    font = await loadFont(loader, FONT_URL);
  } catch (error) {
    console.error("Error loading font:", error);
    return;
  }

  const { songMesh, textMesh, spherePos } = createSongMeshes(
    tracks,
    font,
    songMat,
    textMat
  );

  const points = spherePos.map(
    (pos) => new THREE.Vector3(pos[0], pos[1], pos[2])
  );
  const lineMaterial = new THREE.LineBasicMaterial({ color: 0xffffff });
  const lines = createLines(points, lineMaterial);
  scene.add(...lines);

  const particleMesh = new THREE.Points(particleGeo, material);
  const particleMeshBright = new THREE.Points(
    particleGeoBright,
    materialBright
  );
  scene.add(...textMesh, ...songMesh, particleMeshBright, particleMesh);

  const ambientLight = new THREE.AmbientLight(0xffffff, 1);
  scene.add(ambientLight);

  const sizes = {
    width: window.innerWidth,
    height: window.innerHeight,
  };

  const camera = new THREE.PerspectiveCamera(
    62,
    sizes.width / sizes.height,
    0.1,
    1000
  );
  camera.position.z = 4.5;
  scene.add(camera);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.maxDistance = 7;

  const renderer = new THREE.WebGLRenderer({ canvas });
  renderer.toneMapping = THREE.ReinhardToneMapping;
  renderer.setSize(sizes.width, sizes.height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000022, 1);

  const renderScene = new RenderPass(scene, camera);
  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    1.5,
    0.4,
    0.85
  );
  bloomPass.threshold = 0.3;
  bloomPass.strength = 2;
  bloomPass.radius = 0;

  const filmPass = new FilmPass(0.25, false);
  filmPass.renderToScreen = true;

  const composer = new EffectComposer(renderer);
  composer.addPass(renderScene);
  composer.addPass(bloomPass);
  composer.addPass(filmPass);

  window.addEventListener("resize", () => {
    sizes.width = window.innerWidth;
    sizes.height = window.innerHeight;
    bloomPass.setSize(sizes.width, sizes.height);
    camera.aspect = sizes.width / sizes.height;
    camera.updateProjectionMatrix();
    renderer.setSize(sizes.width, sizes.height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  });

  let color = new THREE.Color(0);
  let hue = 0;

  const tick = () => {
    particleMeshBright.rotateY(0.00008);
    textMesh.forEach((e) => e.setRotationFromEuler(camera.rotation));
    hue = (hue + 0.001) % 1;
    color.setHSL(hue, 1, 0.8);
    songMat.emissive = color;
    renderer.render(scene, camera);
    camera.setRotationFromEuler(
      new THREE.Euler(
        camera.rotation.x,
        camera.rotation.y,
        camera.rotation.z + 0.00005
      )
    );
    camera.position.set(
      camera.position.x,
      camera.position.y,
      camera.position.z - 0.0002
    );
    composer.render();
    window.requestAnimationFrame(tick);
  };

  tick();
};

renderFunc();
