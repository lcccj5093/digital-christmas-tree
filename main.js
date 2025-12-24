import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import gsap from 'gsap';

class LayeredChristmasTree {
    constructor() {
        this.container = document.getElementById('container');
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({ antialias: true });

        this.initRenderer();
        this.initPostProcessing();
        this.initLights();

        this.treeGroup = new THREE.Group();
        this.scene.add(this.treeGroup);

        this.state = 'normal';
        this.particles = [];
        this.ornaments = [];
        this.isUserInteracting = false;
        this.autoRotationSpeed = 0.008;

        this.createHierarchicalTree();
        this.createTrunk();
        this.createSnowBackground();
        this.initHandTracking();
        this.initMusic();

        this.camera.position.set(0, 5, 25);
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;

        window.addEventListener('resize', () => this.onWindowResize());
        this.animate();
    }

    initRenderer() {
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.container.appendChild(this.renderer.domElement);
        this.scene.background = new THREE.Color(0x050510); // 极深夜蓝
    }

    initPostProcessing() {
        const renderScene = new RenderPass(this.scene, this.camera);
        this.bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.2, 0.4, 0.85);
        this.composer = new EffectComposer(this.renderer);
        this.composer.addPass(renderScene);
        this.composer.addPass(this.bloomPass);
    }

    initLights() {
        this.scene.add(new THREE.AmbientLight(0xffffff, 0.4));
        const p1 = new THREE.PointLight(0xffffff, 20, 100);
        p1.position.set(10, 10, 10);
        this.scene.add(p1);
    }

    createHierarchicalTree() {
        // 定义 6 层级结构 (从下到上)
        const tiers = [
            { count: 18000, rBase: 6.0, rTop: 2.0, h: 2.5, y: -4 },
            { count: 15000, rBase: 5.0, rTop: 1.5, h: 2.5, y: -2.2 },
            { count: 12000, rBase: 4.0, rTop: 1.0, h: 2.5, y: -0.2 },
            { count: 10000, rBase: 3.0, rTop: 0.5, h: 2.0, y: 1.8 },
            { count: 8000, rBase: 2.0, rTop: 0.2, h: 1.8, y: 3.6 },
            { count: 5000, rBase: 1.0, rTop: 0.0, h: 1.5, y: 5.2 }
        ];

        const greenColor = new THREE.Color(0x228b22); // 翠绿
        const darkGreenColor = new THREE.Color(0x0a3d0a); // 深林绿
        const snowColor = new THREE.Color(0xffffff);

        tiers.forEach((tier, index) => {
            const pos = new Float32Array(tier.count * 3);
            const cols = new Float32Array(tier.count * 3);

            for (let i = 0; i < tier.count; i++) {
                const ratio = Math.random();
                const h = ratio * tier.h;
                // 利用噪音让边缘不整齐，形成笔触感
                const angle = Math.random() * Math.PI * 2;
                const rNoise = Math.sin(angle * 8) * 0.4 + (Math.random() - 0.5) * 0.3;
                const r = (1 - ratio) * tier.rBase + ratio * tier.rTop + rNoise;

                pos[i * 3] = Math.cos(angle) * r;
                pos[i * 3 + 1] = h + tier.y;
                pos[i * 3 + 2] = Math.sin(angle) * r;

                // 混合深浅绿色，极少量白色积雪
                let colMix;
                const rand = Math.random();
                if (rand > 0.95) colMix = snowColor;
                else if (rand > 0.4) colMix = greenColor;
                else colMix = darkGreenColor;

                cols[i * 3] = colMix.r;
                cols[i * 3 + 1] = colMix.g;
                cols[i * 3 + 2] = colMix.b;
            }

            const geo = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(pos, 3));
            geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
            const mat = new THREE.PointsMaterial({ size: 0.08, vertexColors: true, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending });
            const points = new THREE.Points(geo, mat);
            points.userData.originals = new Float32Array(pos);
            this.treeGroup.add(points);
            this.particles.push(points);

            // 在每一层添加 2-3 个彩色大灯珠
            this.addOrnaments(tier);
        });

        // 顶端大星
        const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.7), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 4 }));
        star.position.y = 7.5;
        star.userData.origPos = star.position.clone();
        this.treeGroup.add(star);
        this.topStar = star;
    }

    addOrnaments(tier) {
        const colors = [0xff66bb, 0x66ff88, 0xffaa44]; // 粉、绿、橘
        for (let i = 0; i < 4; i++) {
            const angle = Math.random() * Math.PI * 2;
            const r = tier.rBase * 0.8;
            const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.25, 12, 12), new THREE.MeshStandardMaterial({ color: colors[i % 3], emissive: colors[i % 3], emissiveIntensity: 2 }));
            mesh.position.set(Math.cos(angle) * r, tier.y + 0.5, Math.sin(angle) * r);
            mesh.userData.origPos = mesh.position.clone();
            this.treeGroup.add(mesh);
            this.ornaments.push(mesh);
        }
    }

    createTrunk() {
        const trunkGeo = new THREE.CylinderGeometry(0.7, 1.2, 4, 16);
        const trunkMat = new THREE.MeshStandardMaterial({ color: 0x221100 }); // 写实深褐色树干
        const trunk = new THREE.Mesh(trunkGeo, trunkMat);
        trunk.position.y = -5.5;
        trunk.userData.origPos = trunk.position.clone();
        this.treeGroup.add(trunk);
        this.trunk = trunk;
    }

    // createGlowingSpiral() { // Removed createGlowingSpiral function
    //     const curvePoints = [];
    //     for (let t = 0; t < 30; t += 0.2) {
    //         const h = (t / 30) * 12 - 4.5;
    //         const r = (1 - t / 35) * 6.5;
    //         curvePoints.push(new THREE.Vector3(Math.cos(t * 1.5) * r, h, Math.sin(t * 1.5) * r));
    //     }
    //     const curve = new THREE.CatmullRomCurve3(curvePoints);
    //     const tubeGeo = new THREE.TubeGeometry(curve, 100, 0.06, 8, false);
    //     const tubeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 3 });
    //     this.spiral = new THREE.Mesh(tubeGeo, tubeMat);
    //     this.spiral.userData.origPos = new THREE.Vector3(0, 0, 0);
    //     this.treeGroup.add(this.spiral);
    // }

    createSnowBackground() {
        const count = 3000;
        const pos = new Float32Array(count * 3);
        for (let i = 0; i < count; i++) {
            pos[i * 3] = (Math.random() - 0.5) * 50;
            pos[i * 3 + 1] = (Math.random() - 0.5) * 50;
            pos[i * 3 + 2] = (Math.random() - 0.5) * 50;
        }
        const geo = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(pos, 3));
        const mat = new THREE.PointsMaterial({ size: 0.1, color: 0xffffff, transparent: true, opacity: 0.6 });
        this.snow = new THREE.Points(geo, mat);
        this.scene.add(this.snow);
    }

    initMusic() {
        this.audioCtx = null;
        this.musicPlaying = false;
        this.noteIndex = 0;
        this.nextNoteTime = 0;

        const E4 = 329.63, G4 = 392.00, C4 = 261.63, D4 = 293.66, F4 = 349.23;
        this.melody = [
            [E4, 0.2], [E4, 0.2], [E4, 0.4], [E4, 0.2], [E4, 0.2], [E4, 0.4],
            [E4, 0.2], [G4, 0.2], [C4, 0.3], [D4, 0.1], [E4, 0.8],
            [F4, 0.2], [F4, 0.2], [F4, 0.2], [F4, 0.2], [F4, 0.2], [E4, 0.2], [E4, 0.2]
        ];

        // 浮动交互提示
        this.hint = document.createElement('div');
        this.hint.id = 'audio-hint';
        this.hint.innerHTML = '✨ 挥挥手或点击屏幕，唤醒圣诞旋律 ✨';
        this.hint.style.cssText = 'position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); color:white; background:rgba(0,0,0,0.6); padding:20px 40px; border-radius:50px; font-weight:bold; z-index:2000; pointer-events:none; border:1px solid #00ffff; backdrop-filter:blur(5px); transition: opacity 0.5s; text-align:center;';
        document.body.appendChild(this.hint);

        window.addEventListener('mousedown', () => this.startLogic());
        window.addEventListener('touchstart', () => this.startLogic());
    }

    startLogic() {
        if (!this.audioCtx) {
            try {
                this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                this.musicPlaying = true;
                this.nextNoteTime = this.audioCtx.currentTime;
                this.scheduler();
                if (this.hint) {
                    this.hint.style.opacity = '0';
                    setTimeout(() => this.hint.remove(), 500);
                }
                console.log('圣诞旋律已唤醒');
            } catch (e) {
                console.error('音频唤醒受阻:', e);
            }
        }
    }

    scheduler() {
        if (!this.musicPlaying) return;
        while (this.nextNoteTime < this.audioCtx.currentTime + 0.1) {
            this.playNote(this.melody[this.noteIndex][0], this.nextNoteTime, this.melody[this.noteIndex][1]);
            this.nextNoteTime += this.melody[this.noteIndex][1] + 0.05;
            this.noteIndex = (this.noteIndex + 1) % this.melody.length;
        }
        setTimeout(() => this.scheduler(), 50);
    }

    playNote(freq, time, duration) {
        if (!this.audioCtx) return;
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, time);
        gain.gain.setValueAtTime(0.1, time);
        gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        osc.start(time);
        osc.stop(time + duration);
    }

    initHandTracking() {
        if (!window.Hands) return;
        const hands = new window.Hands({ locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}` });
        hands.setOptions({ maxNumHands: 1, modelComplexity: 1, minDetectionConfidence: 0.7, minTrackingConfidence: 0.7 });
        hands.onResults((res) => {
            if (res.multiHandLandmarks && res.multiHandLandmarks.length > 0) {
                // 核心：一旦检测到手，立刻尝试启动音频逻辑
                this.startLogic();

                this.isUserInteracting = true;
                const lm = res.multiHandLandmarks[0];
                gsap.killTweensOf(this.treeGroup.rotation);
                this.treeGroup.rotation.y = (lm[9].x - 0.5) * Math.PI * 3;

                const openCount = [8, 12, 16, 20].filter(i => lm[i].y < lm[i - 2].y).length;
                if (openCount >= 3 && this.state === 'normal') this.explode();
                if (openCount === 0 && this.state === 'exploded') this.contract();

                const statusEl = document.getElementById('status');
                if (statusEl) statusEl.innerText = openCount >= 3 ? '手势：全屏解构 💥' : (openCount === 0 ? '手势：寒冬重构 ✨' : '控制旋转中...');
            } else {
                this.isUserInteracting = false;
            }
        });
        const cam = new window.Camera(document.getElementById('input-video'), {
            onFrame: async () => await hands.send({ image: document.getElementById('input-video') }),
            width: 320, height: 240
        });
        cam.start();
    }

    onHandResults(results) {
        if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
            this.isUserInteracting = true;
            const lm = results.multiHandLandmarks[0];

            // 立即停止当前的物理/动画旋转，切换到手动
            gsap.killTweensOf(this.treeGroup.rotation);

            const targetRot = (lm[9].x - 0.5) * Math.PI * 3;
            this.treeGroup.rotation.y = targetRot;

            const openCount = [8, 12, 16, 20].filter(i => lm[i].y < lm[i - 2].y).length;
            if (openCount >= 3 && this.state === 'normal') this.explode();
            if (openCount === 0 && this.state === 'exploded') this.contract();

            const statusEl = document.getElementById('status');
            if (statusEl) statusEl.innerText = openCount >= 3 ? '手势：全屏解构 💥' : (openCount === 0 ? '手势：寒冬重构 ✨' : '控制旋转中...');
        } else {
            // 无手势时，标记为非用户交互
            this.isUserInteracting = false;
        }
    }

    explode() {
        if (this.state !== 'normal') return;
        this.state = 'exploding';
        this.particles.forEach(p => {
            const arr = p.geometry.attributes.position.array;
            for (let i = 0; i < arr.length / 3; i++) {
                gsap.to(arr, {
                    [i * 3]: (Math.random() - 0.5) * 50 + arr[i * 3],
                    [i * 3 + 1]: (Math.random() - 0.5) * 50 + arr[i * 3 + 1],
                    [i * 3 + 2]: (Math.random() - 0.5) * 50 + arr[i * 3 + 2],
                    duration: 1.5, ease: "power2.out",
                    onUpdate: () => p.geometry.attributes.position.needsUpdate = true
                });
            }
        });
        [...this.ornaments, this.trunk, this.topStar].forEach(o => {
            gsap.to(o.position, {
                x: (Math.random() - 0.5) * 30, y: (Math.random() - 0.5) * 30, z: (Math.random() - 0.5) * 30,
                duration: 1.5, ease: "power2.out"
            });
            gsap.to(o.rotation, { x: 5, y: 5, duration: 2 });
        });
        setTimeout(() => this.state = 'exploded', 1600);
    }

    contract() {
        if (this.state !== 'exploded') return;
        this.state = 'contracting';
        this.particles.forEach(p => {
            const arr = p.geometry.attributes.position.array;
            const orig = p.userData.originals;
            for (let i = 0; i < arr.length / 3; i++) {
                gsap.to(arr, {
                    [i * 3]: orig[i * 3], [i * 3 + 1]: orig[i * 3 + 1], [i * 3 + 2]: orig[i * 3 + 2],
                    duration: 2, ease: "expo.inOut",
                    onUpdate: () => p.geometry.attributes.position.needsUpdate = true
                });
            }
        });
        [...this.ornaments, this.trunk, this.topStar].forEach(o => {
            const orig = o.userData.origPos;
            gsap.to(o.position, { x: orig.x, y: orig.y, z: orig.z, duration: 2, ease: "expo.inOut" });
            gsap.to(o.rotation, { x: 0, y: 0, z: 0, duration: 2 });
        });
        setTimeout(() => this.state = 'normal', 2100);
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        this.controls.update();

        // 自动旋转：当没有用户交互时执行
        if (!this.isUserInteracting) {
            this.treeGroup.rotation.y += this.autoRotationSpeed;
        }

        if (this.topStar) this.topStar.rotation.y += 0.05;
        if (this.snow) this.snow.rotation.y += 0.002;
        // 彩灯呼吸
        const t = performance.now() * 0.005;
        this.ornaments.forEach((o, i) => {
            o.material.emissiveIntensity = 2 + Math.sin(t + i) * 2;
        });
        this.composer.render();
    }
}

new LayeredChristmasTree();
