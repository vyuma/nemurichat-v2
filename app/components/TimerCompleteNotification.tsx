"use client";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { VRMLoaderPlugin } from "@pixiv/three-vrm";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onChat: () => void;
};

export default function TimerCompleteNotification({ isOpen, onClose, onChat }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const vrmRef = useRef<any>(null);
  const animationIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isOpen || !containerRef.current) return;

    const container = containerRef.current;
    const width = 200;
    const height = 200;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();

    const ambientLight = new THREE.AmbientLight(0xffffff, 2);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
    dirLight.position.set(3, 5, 3);
    scene.add(dirLight);

    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 20.0);
    camera.position.set(0, 1.4, 1.5);
    camera.lookAt(0, 1.3, 0);

    const loader = new GLTFLoader();
    loader.register((parser) => new VRMLoaderPlugin(parser));

    let time = 0;

    const animate = () => {
      animationIdRef.current = requestAnimationFrame(animate);
      time += 0.02;

      if (vrmRef.current) {
        const vrm = vrmRef.current;

        vrm.scene.position.y = Math.sin(time * 2) * 0.02 - 0.05;

        const baseRotationY = Math.PI;
        vrm.scene.rotation.y = baseRotationY + Math.sin(time * 1.5) * 0.08;

        // 笑顔の表情
        if (vrm.expressionManager) {
          vrm.expressionManager.setValue("happy", 0.7);
          vrm.expressionManager.update();
        }

        // 瞬き
        if (vrm.expressionManager && Math.random() < 0.005) {
          const blink = async () => {
            vrm.expressionManager.setValue("blinkLeft", 1.0);
            vrm.expressionManager.setValue("blinkRight", 1.0);
            vrm.expressionManager.update();

            await new Promise((r) => setTimeout(r, 50));

            for (let i = 1.0; i >= 0; i -= 0.1) {
              vrm.expressionManager.setValue("blinkLeft", i);
              vrm.expressionManager.setValue("blinkRight", i);
              vrm.expressionManager.update();
              await new Promise((r) => setTimeout(r, 5));
            }
          };
          blink();
        }
      }

      renderer.render(scene, camera);
    };

    loader.load(
      "/models/alice.vrm",
      (gltf: any) => {
        const vrm = gltf.userData.vrm;
        vrmRef.current = vrm;
        scene.add(vrm.scene);

        vrm.scene.rotation.y = Math.PI;
        vrm.scene.scale.set(1.0, 1.0, 1.0);

        const bbox = new THREE.Box3().setFromObject(vrm.scene);
        vrm.scene.position.y = -bbox.min.y - 0.1;

        // 手を振るポーズ
        if (vrm.humanoid) {
          const rightUpperArm = vrm.humanoid.getRawBoneNode("rightUpperArm");
          const rightLowerArm = vrm.humanoid.getRawBoneNode("rightLowerArm");
          const rightHand = vrm.humanoid.getRawBoneNode("rightHand");
          if (rightUpperArm && rightLowerArm && rightHand) {
            rightUpperArm.rotation.z = -1.8;
            rightUpperArm.rotation.x = 0.3;
            rightLowerArm.rotation.x = 0.5;
            rightHand.rotation.y = 0.2;
          }

          const leftUpperArm = vrm.humanoid.getRawBoneNode("leftUpperArm");
          const leftLowerArm = vrm.humanoid.getRawBoneNode("leftLowerArm");
          if (leftUpperArm && leftLowerArm) {
            leftUpperArm.rotation.z = 0.3;
            leftLowerArm.rotation.x = 0.1;
          }
        }

        animate();
      },
      undefined,
      (error) => console.error("VRMロードエラー:", error)
    );

    return () => {
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
      }
      vrmRef.current = null;
      container.removeChild(renderer.domElement);
      renderer.dispose();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 背景オーバーレイ */}
      <div
        className="absolute inset-0 bg-amber-950/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* モーダル */}
      <div className="relative bg-linear-to-br from-amber-50 to-orange-100 rounded-3xl p-6 shadow-2xl max-w-sm mx-4 animate-bounce-in border border-amber-200">
        {/* 閉じるボタン */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-amber-400 hover:text-amber-600 transition"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>

        {/* VRMアバター */}
        <div className="flex justify-center mb-4">
          <div
            ref={containerRef}
            className="w-[200px] h-[200px] rounded-full overflow-hidden bg-linear-to-b from-amber-100 to-orange-200 shadow-inner"
          />
        </div>

        {/* メッセージ */}
        <div className="text-center mb-6">
          <h3 className="text-xl font-bold text-amber-800 mb-2">
            お疲れさま！
          </h3>
          <p className="text-amber-900/80 leading-relaxed">
            集中して頑張ったね！<br />
            <span className="text-amber-700 font-semibold">一緒にお話ししない？</span>
          </p>
        </div>

        {/* ボタン */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 px-4 bg-amber-100 text-amber-700 rounded-xl font-medium hover:bg-amber-200 transition border border-amber-200"
          >
            あとで
          </button>
          <button
            onClick={onChat}
            className="flex-1 py-3 px-4 bg-linear-to-r from-amber-500 to-orange-500 text-white rounded-xl font-medium hover:from-amber-600 hover:to-orange-600 transition shadow-lg"
          >
            話す！
          </button>
        </div>
      </div>

      <style jsx>{`
        @keyframes bounce-in {
          0% {
            opacity: 0;
            transform: scale(0.3) translateY(50px);
          }
          50% {
            transform: scale(1.05) translateY(-10px);
          }
          70% {
            transform: scale(0.95) translateY(5px);
          }
          100% {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
        .animate-bounce-in {
          animation: bounce-in 0.6s ease-out;
        }
      `}</style>
    </div>
  );
}
