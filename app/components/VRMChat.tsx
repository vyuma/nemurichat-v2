"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { VRMLoaderPlugin } from "@pixiv/three-vrm";
import {
  type VRMExpression,
  type VRMAnimation,
  EXPRESSION_CONFIGS,
} from "../lib/vrm/expressions";

type Props = {
  isSpeaking: boolean;
  isThinking?: boolean;
  expression: VRMExpression;
  animation: VRMAnimation;
};

export default function VRMChat({
  isSpeaking,
  isThinking = false,
  expression,
  animation,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const vrmRef = useRef<any>(null);
  const isSpeakingRef = useRef(isSpeaking);
  const isThinkingRef = useRef(isThinking);
  const expressionRef = useRef<VRMExpression>(expression);
  const animationRef = useRef<VRMAnimation>(animation);
  const targetExpressionRef = useRef<Record<string, number>>({});
  const currentExpressionRef = useRef<Record<string, number>>({});

  // propsの変更を追跡
  useEffect(() => {
    isSpeakingRef.current = isSpeaking;
  }, [isSpeaking]);

  useEffect(() => {
    isThinkingRef.current = isThinking;
  }, [isThinking]);

  useEffect(() => {
    expressionRef.current = expression;
    // 目標表情を設定
    targetExpressionRef.current = EXPRESSION_CONFIGS[expression] || {};
  }, [expression]);

  useEffect(() => {
    animationRef.current = animation;
  }, [animation]);

  useEffect(() => {
    if (!containerRef.current) return;

    const SCREEN_WIDTH = window.innerWidth;
    const SCREEN_HEIGHT = window.innerHeight;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
      precision: "highp",
    });

    renderer.setSize(SCREEN_WIDTH, SCREEN_HEIGHT);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    containerRef.current.appendChild(renderer.domElement);

    const scene = new THREE.Scene();

    // 背景画像を設定
    const textureLoader = new THREE.TextureLoader();
    textureLoader.load("/images/home.png", (texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.generateMipmaps = false;
      scene.background = texture;
    });

    const ambientLight = new THREE.AmbientLight(0xffffff, 2);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
    dirLight.position.set(3, 5, 3);
    dirLight.castShadow = true;
    scene.add(dirLight);

    const camera = new THREE.PerspectiveCamera(
      50,
      SCREEN_WIDTH / SCREEN_HEIGHT,
      0.1,
      20.0
    );
    camera.position.set(0, 1.5, 1.8);
    camera.lookAt(0, 1.5, 0);

    const handleResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    window.addEventListener("resize", handleResize);

    const loader = new GLTFLoader();
    loader.register((parser) => new VRMLoaderPlugin(parser));

    let time = 0;
    const EXPRESSION_LERP_SPEED = 0.08; // 表情遷移速度
    const MOUTH_EXPRESSIONS = ["aa", "ih", "ou", "ee", "oh"];
    const EMOTION_EXPRESSIONS = ["happy", "angry", "sad", "relaxed", "surprised", "neutral"];

    // 表情を滑らかに遷移させる
    const lerpExpression = (current: number, target: number, speed: number): number => {
      return current + (target - current) * speed;
    };

    const animate = () => {
      requestAnimationFrame(animate);
      time += 0.01;

      if (vrmRef.current) {
        const vrm = vrmRef.current;
        const currentAnim = animationRef.current;
        const isThinking = isThinkingRef.current;

        // アニメーションに応じた上半身の動き
        if (vrm.humanoid) {
          const spine = vrm.humanoid.getRawBoneNode("spine");
          const chest = vrm.humanoid.getRawBoneNode("chest");
          const head = vrm.humanoid.getRawBoneNode("head");

          // 基本の揺れ
          let spineSwayZ = Math.sin(time * 0.8) * 0.03;
          let spineSwayX = Math.sin(time * 0.5) * 0.02;
          let chestSwayZ = Math.sin(time * 0.8 + 0.5) * 0.02;
          let headSwayZ = Math.sin(time * 1.2) * 0.02;
          let headSwayX = Math.sin(time * 0.6) * 0.015;

          // 考え中モーション
          if (isThinking) {
            headSwayZ = Math.sin(time * 0.5) * 0.08; // 首を傾ける
            headSwayX = 0.08; // 少し上を見る
          }

          // アニメーション別の動き
          switch (currentAnim) {
            case "thinking":
              headSwayZ = Math.sin(time * 0.5) * 0.08;
              headSwayX = 0.08;
              break;
            case "nod":
              // うなずき動作
              headSwayX = Math.sin(time * 3) * 0.1;
              break;
            case "sleepy":
              // ゆっくりとした動き
              spineSwayZ = Math.sin(time * 0.3) * 0.05;
              headSwayX = Math.sin(time * 0.2) * 0.08;
              break;
            case "lookAround":
              // きょろきょろ
              headSwayZ = Math.sin(time * 2) * 0.1;
              break;
            case "idle":
            default:
              // デフォルトの揺れ
              break;
          }

          if (spine) {
            spine.rotation.z = spineSwayZ;
            spine.rotation.x = spineSwayX;
          }

          if (chest) {
            chest.rotation.z = chestSwayZ;
          }

          if (head) {
            head.rotation.z = headSwayZ;
            head.rotation.x = headSwayX;
          }
        }

        const baseRotationY = Math.PI;
        vrm.scene.rotation.y = baseRotationY + Math.sin(time * 0.9) * 0.03;

        if (vrm.expressionManager) {
          // 表情の適用（口パクと独立）
          const targetExpression = targetExpressionRef.current;

          // 感情表情を滑らかに遷移
          for (const expr of EMOTION_EXPRESSIONS) {
            const targetValue = targetExpression[expr] ?? 0;
            const currentValue = currentExpressionRef.current[expr] ?? 0;
            const newValue = lerpExpression(currentValue, targetValue, EXPRESSION_LERP_SPEED);
            currentExpressionRef.current[expr] = newValue;

            // VRMに設定（表情名がVRM側で対応している場合のみ）
            try {
              vrm.expressionManager.setValue(expr, newValue);
            } catch {
              // 対応していない表情は無視
            }
          }

          // 口パクアニメーション（話している時のみ）
          if (isSpeakingRef.current) {
            const speed = 4;
            const t = time * speed;
            const open = Math.abs(Math.sin(t));

            // 全ての口形をリセット
            for (const vowel of MOUTH_EXPRESSIONS) {
              vrm.expressionManager.setValue(vowel, 0);
            }

            const vowelIndex = Math.floor(t) % 5;
            vrm.expressionManager.setValue(MOUTH_EXPRESSIONS[vowelIndex], open);
          } else {
            // 話していない時: 口を閉じる
            for (const vowel of MOUTH_EXPRESSIONS) {
              vrm.expressionManager.setValue(vowel, 0);
            }
          }

          vrm.expressionManager.update();

          // 瞬き（考え中は半目）
          if (isThinking) {
            // 考え中は少し目を細める
            vrm.expressionManager.setValue("blinkLeft", 0.3);
            vrm.expressionManager.setValue("blinkRight", 0.3);
          } else if (Math.random() < 0.003) {
            // 通常の瞬き
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
      }

      renderer.render(scene, camera);
    };

    loader.load(
      "/models/nemuri.vrm",
      (gltf: any) => {
        const vrm = gltf.userData.vrm;
        vrmRef.current = vrm;
        scene.add(vrm.scene);

        vrm.scene.rotation.y = Math.PI;
        vrm.scene.scale.set(1.2, 1.2, 1.2);

        const bbox = new THREE.Box3().setFromObject(vrm.scene);
        vrm.scene.position.y = -bbox.min.y;

        if (vrm.humanoid) {
          const rightUpperArm = vrm.humanoid.getRawBoneNode("rightUpperArm");
          const rightLowerArm = vrm.humanoid.getRawBoneNode("rightLowerArm");
          const rightHand = vrm.humanoid.getRawBoneNode("rightHand");
          if (rightUpperArm && rightLowerArm) {
            rightUpperArm.rotation.z = -1.3;
            rightUpperArm.rotation.x = 0.1;
            rightLowerArm.rotation.x = 0.1;
            rightHand.rotation.y = 0.1;
            rightHand.rotation.z = 0.01;
          }

          const leftUpperArm = vrm.humanoid.getRawBoneNode("leftUpperArm");
          const leftLowerArm = vrm.humanoid.getRawBoneNode("leftLowerArm");
          const leftHand = vrm.humanoid.getRawBoneNode("leftHand");
          if (leftUpperArm && leftLowerArm) {
            leftUpperArm.rotation.z = 1.3;
            leftUpperArm.rotation.x = 0.1;
            leftLowerArm.rotation.x = 0.5;
            leftHand.rotation.y = 0.1;
            leftHand.rotation.z = 0.1;
          }
        }

        animate();
      },
      undefined,
      (error) => console.error("VRMロードエラー:", error)
    );

    return () => {
      window.removeEventListener("resize", handleResize);
      containerRef.current?.removeChild(renderer.domElement);
      renderer.dispose();
    };
  }, []);

  return <div ref={containerRef} className="w-full h-full" />;
}
