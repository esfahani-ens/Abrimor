import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { FontLoader } from "three/addons/loaders/FontLoader.js";
import { TextGeometry } from "three/addons/geometries/TextGeometry.js";
import { STLExporter } from "three/addons/exporters/STLExporter.js";

const stage = document.querySelector("#preview-stage");
const loading = document.querySelector("#loading-state");
const textInput = document.querySelector("#stamp-text");
const widthInput = document.querySelector("#stamp-width");
const heightInput = document.querySelector("#stamp-height");
const textCount = document.querySelector("#text-count");
const bodySpec = document.querySelector("#body-spec");
const modelLabel = document.querySelector("#model-label");
const colorName = document.querySelector("#color-name");
const exportButton = document.querySelector("#export-stl");
const notice = document.querySelector("#notice");

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(stage.clientWidth, stage.clientHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
stage.prepend(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(34, stage.clientWidth / stage.clientHeight, 0.1, 1000);
camera.up.set(0, 0, 1);
camera.position.set(108, -120, 112);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.075;
controls.target.set(0, 0, 5);

scene.add(new THREE.HemisphereLight(0xfff8eb, 0x8b8070, 2.0));
const keyLight = new THREE.DirectionalLight(0xffffff, 3.2);
keyLight.position.set(-65, -40, 120);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(1024, 1024);
scene.add(keyLight);
const fillLight = new THREE.DirectionalLight(0xffd6b1, 1.1);
fillLight.position.set(70, 50, 55);
scene.add(fillLight);

const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(500, 500),
  new THREE.ShadowMaterial({ opacity: 0.14 })
);
floor.position.z = -0.25;
floor.receiveShadow = true;
scene.add(floor);

const stampGroup = new THREE.Group();
scene.add(stampGroup);
let font = null;
let bodyMaterial = new THREE.MeshStandardMaterial({ color: "#e5a45f", roughness: 0.48, metalness: 0.02 });
const colorNames = { "#e5a45f": "AMBER", "#5e877a": "SAGE", "#687a9e": "BLUE", "#c97868": "CORAL", "#4c4a47": "CHARCOAL" };

function dimensions() {
  const width = Math.min(100, Math.max(40, Number(widthInput.value) || 76));
  const height = Math.min(80, Math.max(30, Number(heightInput.value) || 48));
  widthInput.value = width;
  heightInput.value = height;
  return { width, height, thickness: 9 };
}

function rebuildStamp() {
  if (!font) return;
  while (stampGroup.children.length) {
    const old = stampGroup.children.pop();
    old.geometry?.dispose();
    if (old.material !== bodyMaterial) old.material?.dispose();
  }

  const { width, height, thickness } = dimensions();
  const body = new THREE.Mesh(new THREE.BoxGeometry(width, height, thickness), bodyMaterial);
  body.position.z = thickness / 2;
  body.castShadow = true;
  body.receiveShadow = true;
  stampGroup.add(body);

  const label = textInput.value.trim().toUpperCase().slice(0, 16) || " ";
  const relief = new TextGeometry(label, {
    font,
    size: 8,
    depth: 2,
    curveSegments: 8,
    bevelEnabled: true,
    bevelThickness: 0.25,
    bevelSize: 0.18,
    bevelSegments: 2
  });
  relief.computeBoundingBox();
  const bounds = relief.boundingBox;
  const textWidth = bounds.max.x - bounds.min.x;
  const textHeight = bounds.max.y - bounds.min.y;
  const fit = Math.min(1, (width - 10) / Math.max(textWidth, 1), (height - 10) / Math.max(textHeight, 1));
  relief.translate(-(bounds.min.x + bounds.max.x) / 2, -(bounds.min.y + bounds.max.y) / 2, -bounds.min.z);
  relief.scale(fit, fit, fit);
  const letterMaterial = new THREE.MeshStandardMaterial({ color: "#f4c28f", roughness: 0.38, metalness: 0.01 });
  const letters = new THREE.Mesh(relief, letterMaterial);
  letters.scale.x = -1;
  letters.position.z = thickness;
  letters.castShadow = true;
  letters.receiveShadow = true;
  stampGroup.add(letters);

  textCount.textContent = `${textInput.value.length} / 16`;
  bodySpec.textContent = `${width} × ${height} mm`;
  modelLabel.textContent = label === " " ? "CUSTOM STAMP" : label;
  notice.textContent = "";
}

const resizeObserver = new ResizeObserver(() => {
  const { clientWidth, clientHeight } = stage;
  if (!clientWidth || !clientHeight) return;
  renderer.setSize(clientWidth, clientHeight);
  camera.aspect = clientWidth / clientHeight;
  camera.updateProjectionMatrix();
});
resizeObserver.observe(stage);

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
animate();

new FontLoader().load(
  "https://cdn.jsdelivr.net/npm/three@0.180.0/examples/fonts/helvetiker_bold.typeface.json",
  (loadedFont) => {
    font = loadedFont;
    rebuildStamp();
    loading.classList.add("hidden");
    exportButton.disabled = false;
  },
  undefined,
  () => {
    loading.innerHTML = "<span>Font could not load. Check your connection and refresh.</span>";
    notice.textContent = "The 3D font is hosted by jsDelivr.";
  }
);

textInput.addEventListener("input", rebuildStamp);
for (const input of [widthInput, heightInput]) {
  input.addEventListener("change", () => {
    dimensions();
    rebuildStamp();
  });
}
document.querySelectorAll(".swatch").forEach((swatch) => {
  swatch.addEventListener("click", () => {
    document.querySelector(".swatch.active")?.classList.remove("active");
    swatch.classList.add("active");
    const color = swatch.dataset.color;
    bodyMaterial.color.set(color);
    colorName.textContent = colorNames[color] || "CUSTOM";
  });
});

document.querySelector("#reset-view").addEventListener("click", () => {
  camera.position.set(108, -120, 112);
  controls.target.set(0, 0, 5);
  controls.update();
});

exportButton.addEventListener("click", () => {
  try {
    const exporter = new STLExporter();
    const data = exporter.parse(stampGroup, { binary: true });
    const blob = new Blob([data], { type: "model/stl" });
    const link = document.createElement("a");
    const safeName = (textInput.value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "abrimor-stamp");
    link.href = URL.createObjectURL(blob);
    link.download = `${safeName}.stl`;
    link.click();
    URL.revokeObjectURL(link.href);
    notice.textContent = "Your STL is ready for your 3D printing workflow.";
  } catch (error) {
    console.error(error);
    notice.textContent = "Export failed. Please refresh and try again.";
  }
});
