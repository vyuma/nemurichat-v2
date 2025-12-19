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
  expression?: VRMExpression;
  animation?: VRMAnimation;
};

export default function VRMChat({
  isSpeaking,
  expression = "neutral",
  animation = "idle",
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const vrmRef = useRef<any>(null);
  const isSpeakingRef = useRef(isSpeaking);
  const expressionRef = useRef<VRMExpression>(expression);
  const animationRef = useRef<VRMAnimation>(animation);

  // isSpeakingの変更を追跡
  useEffect(() => {
    isSpeakingRef.current = isSpeaking;
  }, [isSpeaking]);

  // expressionの変更を追跡
  useEffect(() => {
    expressionRef.current = expression;
  }, [expression]);

  // animationの変更を追跡
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
    camera.position.set(0, 1.0, 1.8);
    camera.lookAt(0, 1.2, 0);

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
    // アニメーション用の状態
    let lookTargetY = 0;
    let currentLookY = 0;
    let sleepyBlinkValue = 0;
    let nodPhase = 0;

    const animate = () => {
      requestAnimationFrame(animate);
      time += 0.01;

      if (vrmRef.current) {
        const vrm = vrmRef.current;
        const currentAnimation = animationRef.current;

        // 上半身だけ揺らす（ベースアニメーション）
        if (vrm.humanoid) {
          const spine = vrm.humanoid.getRawBoneNode("spine");
          const chest = vrm.humanoid.getRawBoneNode("chest");
          const head = vrm.humanoid.getRawBoneNode("head");
          const neck = vrm.humanoid.getRawBoneNode("neck");

          // ベースの揺れ
          if (spine) {
            spine.rotation.z = Math.sin(time * 0.8) * 0.03;
            spine.rotation.x = Math.sin(time * 0.5) * 0.02;
          }

          if (chest) {
            chest.rotation.z = Math.sin(time * 0.8 + 0.5) * 0.02;
          }

          // アニメーションタイプに応じた動き
          switch (currentAnimation) {
            case "lookAround":
              // きょろきょろ：ランダムに横を向く
              if (Math.random() < 0.005) {
                lookTargetY = (Math.random() - 0.5) * 0.6; // -0.3 ~ 0.3
              }
              currentLookY += (lookTargetY - currentLookY) * 0.02;
              if (head) {
                head.rotation.y = currentLookY;
                head.rotation.z = Math.sin(time * 1.2) * 0.02;
                head.rotation.x = Math.sin(time * 0.6) * 0.015;
              }
              if (neck) {
                neck.rotation.y = currentLookY * 0.3;
              }
              break;

            case "sleepy":
              // 眠たげ：うつらうつら + 目を細める
              if (head) {
                // 頭がゆっくり前に傾く
                head.rotation.x = 0.1 + Math.sin(time * 0.4) * 0.08;
                head.rotation.z = Math.sin(time * 0.25) * 0.05;
                // たまにカクッとなる
                if (Math.random() < 0.002) {
                  head.rotation.x = -0.1;
                }
              }
              // 目を細める
              sleepyBlinkValue = 0.5 + Math.sin(time * 0.5) * 0.3;
              break;

            case "thinking":
              // 考え中：首をかしげる
              if (head) {
                head.rotation.z = 0.15 + Math.sin(time * 0.8) * 0.03;
                head.rotation.x = -0.05 + Math.sin(time * 0.6) * 0.02;
                head.rotation.y = Math.sin(time * 0.4) * 0.1;
              }
              break;

            case "nod":
              // うなずき
              nodPhase += 0.08;
              if (head) {
                const nodValue = Math.sin(nodPhase) * 0.15;
                head.rotation.x = nodValue > 0 ? nodValue : 0;
                head.rotation.z = Math.sin(time * 1.2) * 0.01;
              }
              // 一定時間後にリセット
              if (nodPhase > Math.PI * 4) {
                nodPhase = 0;
              }
              break;

            case "idle":
            default:
              // 通常待機
              if (head) {
                head.rotation.z = Math.sin(time * 1.2) * 0.02;
                head.rotation.x = Math.sin(time * 0.6) * 0.015;
                head.rotation.y = Math.sin(time * 0.4) * 0.02;
              }
              // lookTargetをリセット
              lookTargetY = 0;
              currentLookY += (0 - currentLookY) * 0.02;
              sleepyBlinkValue = 0;
              break;
          }
        }

        // 斜め約10度をベースに微小な揺れを追加
        const baseRotationY = Math.PI + 0.17;
        vrm.scene.rotation.y = baseRotationY + Math.sin(time * 0.9) * 0.03;

        // 表情と口パクアニメーション
        if (vrm.expressionManager) {
          // まず全ての表情をリセット
          const allExpressions = ["happy", "angry", "sad", "relaxed", "surprised", "neutral"];
          for (const expr of allExpressions) {
            try {
              vrm.expressionManager.setValue(expr, 0);
            } catch {
              // 表情が存在しない場合は無視
            }
          }

          // 現在の表情を適用
          const currentExpression = expressionRef.current;
          const expressionConfig = EXPRESSION_CONFIGS[currentExpression];
          for (const [name, value] of Object.entries(expressionConfig)) {
            try {
              vrm.expressionManager.setValue(name, value);
            } catch {
              // 表情が存在しない場合は無視
            }
          }

          // 口パクアニメーション（話している時のみ）
          if (isSpeakingRef.current) {
            // 話している時: あいうえおの口パク
            const speed = 4;
            const t = time * speed;
            const open = Math.abs(Math.sin(t));

            vrm.expressionManager.setValue("aa", 0);
            vrm.expressionManager.setValue("ih", 0);
            vrm.expressionManager.setValue("ou", 0);
            vrm.expressionManager.setValue("ee", 0);
            vrm.expressionManager.setValue("oh", 0);

            const vowelIndex = Math.floor(t) % 5;
            switch (vowelIndex) {
              case 0:
                vrm.expressionManager.setValue("aa", open);
                break;
              case 1:
                vrm.expressionManager.setValue("ih", open);
                break;
              case 2:
                vrm.expressionManager.setValue("ou", open);
                break;
              case 3:
                vrm.expressionManager.setValue("ee", open);
                break;
              case 4:
                vrm.expressionManager.setValue("oh", open);
                break;
            }
          } else {
            // 話していない時: 口を閉じる
            vrm.expressionManager.setValue("aa", 0);
            vrm.expressionManager.setValue("ih", 0);
            vrm.expressionManager.setValue("ou", 0);
            vrm.expressionManager.setValue("ee", 0);
            vrm.expressionManager.setValue("oh", 0);
          }

          vrm.expressionManager.update();
        }

        // 眠たげアニメーション時の目を細める
        if (vrm.expressionManager && currentAnimation === "sleepy") {
          vrm.expressionManager.setValue("blinkLeft", sleepyBlinkValue);
          vrm.expressionManager.setValue("blinkRight", sleepyBlinkValue);
          vrm.expressionManager.update();
        }
        // 通常の瞬き（眠たげ以外の時）
        else if (vrm.expressionManager && Math.random() < 0.003) {
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
      "/models/nemuri.vrm",
      (gltf: any) => {
        const vrm = gltf.userData.vrm;
        vrmRef.current = vrm;
        scene.add(vrm.scene);

        // 斜め約10度
        vrm.scene.rotation.y = Math.PI + 0.17;
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
