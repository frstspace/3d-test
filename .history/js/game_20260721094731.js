/**
 * 3D Shooter — Главный игровой движок
 */
class Game {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.clock = new THREE.Clock();

        this.player = {
            position: new THREE.Vector3(0, 0, 0),
            health: 100,
            maxHealth: 100,
            yaw: 0,
            pitch: 0,
            speed: 5
        };

        this.controls = new GameControls();
        this.enemies = [];
        this.bullets = [];

        this.score = 0;
        this.wave = 1;
        this.ammo = 30;
        this.maxAmmo = 30;
        this.gameRunning = false;
        this.shootCooldown = 0;
        this.enemiesPerWave = 5;
        this.enemiesSpawned = 0;
        this.waveActive = false;

        this.keys = {};
        this.isPointerLocked = false;
        this.isMobile = /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

        this._init();
    }

    _init() {
        // Сцена
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x1a1a2e);
        this.scene.fog = new THREE.Fog(0x1a1a2e, 30, 80);

        // Камера
        this.camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 100);
        this.camera.position.set(0, 1.6, 0);
        this.camera.rotation.order = 'YXZ';

        // Рендерер
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.0;
        document.getElementById('game-container').appendChild(this.renderer.domElement);

        // Освещение
        const ambientLight = new THREE.AmbientLight(0x404060, 0.5);
        this.scene.add(ambientLight);

        const dirLight = new THREE.DirectionalLight(0xffeedd, 0.8);
        dirLight.position.set(20, 30, 10);
        dirLight.castShadow = true;
        dirLight.shadow.mapSize.width = 1024;
        dirLight.shadow.mapSize.height = 1024;
        this.scene.add(dirLight);

        const fillLight = new THREE.DirectionalLight(0x4488ff, 0.3);
        fillLight.position.set(-10, 10, -20);
        this.scene.add(fillLight);

        const hemiLight = new THREE.HemisphereLight(0x4488ff, 0x002244, 0.4);
        this.scene.add(hemiLight);

        // Создание мира
        this._createWorld();

        // Обработчики событий
        window.addEventListener('resize', () => this._onResize());
        this.renderer.domElement.addEventListener('click', () => this._onPointerClick());
        document.addEventListener('pointerlockchange', () => this._onPointerLockChange());

        // Запуск игрового цикла
        this._gameLoop();
    }

    _createWorld() {
        // Пол
        const groundGeo = new THREE.PlaneGeometry(100, 100);
        const groundMat = new THREE.MeshStandardMaterial({
            color: 0x2a2a3e,
            roughness: 0.8,
            metalness: 0.2
        });
        const ground = new THREE.Mesh(groundGeo, groundMat);
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = -0.01;
        ground.receiveShadow = true;
        this.scene.add(ground);

        // Сетка на полу
        const gridHelper = new THREE.GridHelper(100, 40, 0x4444aa, 0x3333aa);
        gridHelper.position.y = 0.001;
        this.scene.add(gridHelper);

        // Стены по периметру
        const wallMat = new THREE.MeshStandardMaterial({
            color: 0x3a3a5e,
            roughness: 0.7,
            metalness: 0.3
        });
        const wallHeight = 3;
        const wallLength = 50;

        const createWall = (x, z, width, height, depth, rotY = 0) => {
            const geo = new THREE.BoxGeometry(width, height, depth);
            const mesh = new THREE.Mesh(geo, wallMat);
            mesh.position.set(x, height/2, z);
            mesh.rotation.y = rotY;
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            this.scene.add(mesh);
            return mesh;
        };

        // Внешние стены
        createWall(0, -wallLength/2, wallLength, wallHeight, 0.5);
        createWall(0, wallLength/2, wallLength, wallHeight, 0.5);
        createWall(-wallLength/2, 0, 0.5, wallHeight, wallLength);
        createWall(wallLength/2, 0, 0.5, wallHeight, wallLength);

        // Внутренние препятствия (ящики и колонны)
        const boxMat = new THREE.MeshStandardMaterial({
            color: 0x4a4a6e,
            roughness: 0.6,
            metalness: 0.4,
            emissive: 0x222244,
            emissiveIntensity: 0.1
        });

        const obstacles = [
            { x: -8, z: -5, w: 2, h: 1.5, d: 2 },
            { x: 7, z: -6, w: 1.5, h: 2, d: 1.5 },
            { x: -5, z: 8, w: 3, h: 1.2, d: 1.5 },
            { x: 6, z: 7, w: 1.5, h: 2.5, d: 1.5 },
            { x: -10, z: 10, w: 2, h: 2, d: 2 },
            { x: 10, z: -10, w: 2.5, h: 1.8, d: 2.5 },
            { x: 0, z: -12, w: 1.5, h: 2.2, d: 1.5 },
            { x: -12, z: -8, w: 2, h: 1.5, d: 2 },
            { x: 12, z: 8, w: 2, h: 1.5, d: 2 },
            { x: -3, z: -3, w: 1, h: 1, d: 1 },
            { x: 4, z: 4, w: 1, h: 1, d: 1 },
            { x: -6, z: -10, w: 1.5, h: 2, d: 1.5 },
        ];

        obstacles.forEach(o => {
            const geo = new THREE.BoxGeometry(o.w, o.h, o.d);
            const mesh = new THREE.Mesh(geo, boxMat);
            mesh.position.set(o.x, o.h/2, o.z);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            this.scene.add(mesh);
        });

        // Неоновые акценты на полу
        const neonMat = new THREE.MeshBasicMaterial({ color: 0x4444ff, transparent: true, opacity: 0.15 });
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            const r = 5 + Math.random() * 10;
            const strip = new THREE.Mesh(
                new THREE.BoxGeometry(0.05, 0.01, 1.5),
                neonMat.clone()
            );
            strip.position.set(Math.cos(angle) * r, 0.005, Math.sin(angle) * r);
            strip.rotation.y = -angle + Math.PI/2;
            this.scene.add(strip);
        }

        // Частицы окружения
        this._createAmbientParticles();
    }

    _createAmbientParticles() {
        const particlesGeo = new THREE.BufferGeometry();
        const count = 200;
        const positions = new Float32Array(count * 3);
        for (let i = 0; i < count * 3; i++) {
            positions[i] = (Math.random() - 0.5) * 80;
            if (i % 3 === 1) positions[i] = Math.random() * 5;
        }
        particlesGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        const particlesMat = new THREE.PointsMaterial({
            color: 0x6688ff,
            size: 0.05,
            transparent: true,
            opacity: 0.3
        });
        const particles = new THREE.Points(particlesGeo, particlesMat);
        this.scene.add(particles);
        this.particles = particles;
    }

    startGame() {
        document.getElementById('start-screen').classList.add('hidden');
        this.gameRunning = true;
        this.score = 0;
        this.wave = 1;
        this.ammo = this.maxAmmo;
        this.player.health = this.player.maxHealth;
        this.player.position.set(0, 0, 0);
        this.player.yaw = 0;
        this.player.pitch = 0;

        // Удаляем старых врагов
        this.enemies.forEach(e => e.remove());
        this.enemies = [];

        this._updateHUD();
        this._startWave();

        // На ПК пытаемся заблокировать указатель
        if (!this.isMobile) {
            this.renderer.domElement.requestPointerLock();
        }
    }

    _startWave() {
        this.waveActive = true;
        this.enemiesSpawned = 0;
        this.enemiesPerWave = 3 + this.wave * 2;
        this._spawnEnemy();
    }

    _spawnEnemy() {
        if (!this.gameRunning || this.enemiesSpawned >= this.enemiesPerWave) return;

        // Спавн на краю карты
        const angle = Math.random() * Math.PI * 2;
        const dist = 15 + Math.random() * 10;
        const x = Math.cos(angle) * dist;
        const z = Math.sin(angle) * dist;

        // Цвет зависит от волны
        const hue = 0.0 + (this.wave * 0.03);
        const color = new THREE.Color().setHSL(hue, 1, 0.4);
        const enemy = new Enemy(this.scene, new THREE.Vector3(x, 0, z), color);
        this.enemies.push(enemy);
        this.enemiesSpawned++;
    }

    shoot() {
        if (!this.gameRunning || this.shootCooldown > 0 || this.ammo <= 0) return;

        this.ammo--;
        this.shootCooldown = 0.15;

        // Эффект выстрела (лазерный луч из камеры)
        this._createMuzzleFlash();

        // Рейкаст для попадания
        const raycaster = new THREE.Raycaster();
        let direction = new THREE.Vector3(0, 0, -1);
        direction.applyQuaternion(this.camera.quaternion);

        // Aim assist для мобильных — небольшое притяжение к ближайшему врагу
        if (this.isMobile) {
            const assistDir = this._getAimAssistDirection(direction);
            if (assistDir) direction = assistDir;
        }

        raycaster.set(this.camera.position, direction);

        // Проверка попадания во врагов
        const hit = this._checkEnemyHit(raycaster);
        if (hit) {
            const killed = hit.enemy.takeDamage(35);
            if (killed) {
                this.score += 100 * this.wave;
                this._createExplosionEffect(hit.point);
                // Удаляем врага из списка
                const idx = this.enemies.indexOf(hit.enemy);
                if (idx !== -1) this.enemies.splice(idx, 1);
            } else {
                this._createHitEffect(hit.point);
            }
            this._updateHUD();
        }

        // Визуальный след пули
        this._createBulletTrace(direction);

        this._updateHUD();

        // Перезарядка если закончились патроны
        if (this.ammo <= 0) {
            setTimeout(() => this.reload(), 500);
        }
    }

    _tryAutoShoot() {
        // Автоматическая стрельба при наведении на врага (для мобильных)
        if (!this.gameRunning || this.shootCooldown > 0 || this.ammo <= 0) return;

        const raycaster = new THREE.Raycaster();
        const direction = new THREE.Vector3(0, 0, -1);
        direction.applyQuaternion(this.camera.quaternion);
        raycaster.set(this.camera.position, direction);

        const hit = this._checkEnemyHit(raycaster);
        if (hit) {
            this.shoot();
        }
    }

    reload() {
        if (!this.gameRunning) return;
        this.ammo = this.maxAmmo;
        this._updateHUD();
    }

    _checkEnemyHit(raycaster) {
        let closestDist = Infinity;
        let closestEnemy = null;
        let closestPoint = null;

        // Проверяем каждого врага
        for (let j = this.enemies.length - 1; j >= 0; j--) {
            const enemy = this.enemies[j];
            if (!enemy.alive) continue;

            // Проверяем попадание по телу и голове
            const meshes = [];
            enemy.group.traverse((child) => {
                if (child.isMesh) meshes.push(child);
            });

            const intersects = raycaster.intersectObjects(meshes);
            if (intersects.length > 0) {
                const hit = intersects[0];
                if (hit.distance < closestDist) {
                    closestDist = hit.distance;
                    closestEnemy = enemy;
                    closestPoint = hit.point;
                }
            }
        }

        if (closestEnemy) {
            return { enemy: closestEnemy, point: closestPoint };
        }
        return null;
    }

    _getAimAssistDirection(baseDirection) {
        // Найти ближайшего врага в пределах 15 градусов от прицела
        let closestEnemy = null;
        let closestAngle = Infinity;

        for (const enemy of this.enemies) {
            if (!enemy.alive) continue;
            const toEnemy = new THREE.Vector3()
                .subVectors(enemy.getPosition(), this.camera.position)
                .normalize();
            const angle = baseDirection.angleTo(toEnemy);
            // Aim assist в радиусе 12 градусов
            if (angle < closestAngle && angle < 0.21) {
                closestAngle = angle;
                closestEnemy = enemy;
            }
        }

        if (closestEnemy) {
            const toEnemy = new THREE.Vector3()
                .subVectors(closestEnemy.getPosition(), this.camera.position)
                .normalize();
            // Плавное смещение: 60% к врагу
            const result = baseDirection.clone().lerp(toEnemy, 0.6).normalize();
            return result;
        }
        return null;
    }

    _createMuzzleFlash() {
        const flash = new THREE.Mesh(
            new THREE.SphereGeometry(0.05, 4, 4),
            new THREE.MeshBasicMaterial({ color: 0xffff44 })
        );
        const dir = new THREE.Vector3(0, 0, -2);
        dir.applyQuaternion(this.camera.quaternion);
        flash.position.copy(this.camera.position).add(dir);
        this.scene.add(flash);

        setTimeout(() => {
            this.scene.remove(flash);
            flash.geometry.dispose();
            flash.material.dispose();
        }, 50);
    }

    _createBulletTrace(direction) {
        const start = this.camera.position.clone();
        const end = start.clone().add(direction.clone().multiplyScalar(50));

        const points = [start, end];
        const geo = new THREE.BufferGeometry().setFromPoints(points);
        const mat = new THREE.LineBasicMaterial({
            color: 0x44ff44,
            transparent: true,
            opacity: 0.3
        });
        const line = new THREE.Line(geo, mat);
        this.scene.add(line);

        setTimeout(() => {
            this.scene.remove(line);
            geo.dispose();
            mat.dispose();
        }, 80);
    }

    _createHitEffect(position) {
        const particles = new THREE.BufferGeometry();
        const count = 10;
        const positions = new Float32Array(count * 3);
        const colors = new Float32Array(count * 3);

        for (let i = 0; i < count; i++) {
            positions[i*3] = position.x + (Math.random() - 0.5) * 0.5;
            positions[i*3+1] = position.y + (Math.random() - 0.5) * 0.5;
            positions[i*3+2] = position.z + (Math.random() - 0.5) * 0.5;
            colors[i*3] = 1;
            colors[i*3+1] = 0.8;
            colors[i*3+2] = 0;
        }

        particles.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        particles.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        const mat = new THREE.PointsMaterial({
            size: 0.15,
            vertexColors: true,
            transparent: true,
            opacity: 0.6
        });
        const mesh = new THREE.Points(particles, mat);
        this.scene.add(mesh);

        setTimeout(() => {
            this.scene.remove(mesh);
            particles.dispose();
            mat.dispose();
        }, 300);
    }

    _createExplosionEffect(position) {
        // Вспышка
        const flash = new THREE.Mesh(
            new THREE.SphereGeometry(0.8, 8, 8),
            new THREE.MeshBasicMaterial({
                color: 0xff6600,
                transparent: true,
                opacity: 0.8
            })
        );
        flash.position.copy(position);
        this.scene.add(flash);

        setTimeout(() => {
            this.scene.remove(flash);
            flash.geometry.dispose();
            flash.material.dispose();
        }, 200);

        // Частицы
        const count = 20;
        const positions = new Float32Array(count * 3);
        const velocities = [];
        for (let i = 0; i < count; i++) {
            positions[i*3] = position.x;
            positions[i*3+1] = position.y;
            positions[i*3+2] = position.z;
            velocities.push({
                x: (Math.random() - 0.5) * 5,
                y: Math.random() * 5,
                z: (Math.random() - 0.5) * 5
            });
        }

        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        const mat = new THREE.PointsMaterial({
            color: 0xff4400,
            size: 0.2,
            transparent: true,
            opacity: 0.8
        });
        const particles = new THREE.Points(geo, mat);
        this.scene.add(particles);

        const startTime = Date.now();
        const animateParticles = () => {
            const elapsed = Date.now() - startTime;
            if (elapsed > 500 || !this.gameRunning) {
                this.scene.remove(particles);
                geo.dispose();
                mat.dispose();
                return;
            }
            const pos = particles.geometry.attributes.position.array;
            for (let i = 0; i < count; i++) {
                pos[i*3] += velocities[i].x * 0.02;
                pos[i*3+1] += velocities[i].y * 0.02 - 0.01;
                pos[i*3+2] += velocities[i].z * 0.02;
            }
            particles.geometry.attributes.position.needsUpdate = true;
            particles.material.opacity = 0.8 * (1 - elapsed / 500);
            requestAnimationFrame(animateParticles);
        };
        animateParticles();
    }

    _damagePlayer(amount) {
        if (!this.gameRunning) return;
        this.player.health = Math.max(0, this.player.health - amount);
        this._updateHUD();

        // Экран краснеет
        this._showDamageEffect();

        if (this.player.health <= 0) {
            this.gameOver();
        }
    }

    _showDamageEffect() {
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: absolute; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(255, 0, 0, 0.15);
            pointer-events: none; z-index: 5;
            transition: opacity 0.3s ease;
        `;
        document.getElementById('game-container').appendChild(overlay);
        setTimeout(() => {
            overlay.style.opacity = '0';
            setTimeout(() => overlay.remove(), 300);
        }, 100);
    }

    gameOver() {
        this.gameRunning = false;

        // Очищаем таймер спавна
        if (this._spawnTimeout) {
            clearTimeout(this._spawnTimeout);
            this._spawnTimeout = null;
        }

        document.getElementById('final-score').textContent = this.score;
        document.getElementById('final-wave').textContent = this.wave;
        document.getElementById('game-over').classList.remove('hidden');

        if (document.pointerLockElement) {
            document.exitPointerLock();
        }
    }

    _updateHUD() {
        document.getElementById('score-value').textContent = this.score;
        document.getElementById('wave-value').textContent = this.wave;
        document.getElementById('ammo-value').textContent = this.ammo;
        const healthPercent = (this.player.health / this.player.maxHealth) * 100;
        document.getElementById('health-fill').style.width = healthPercent + '%';
    }

    _onResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    _onPointerClick() {
        if (!this.isMobile && this.gameRunning && !document.pointerLockElement) {
            this.renderer.domElement.requestPointerLock();
        }
    }

    _onPointerLockChange() {
        this.isPointerLocked = !!document.pointerLockElement;
    }

    _checkCollisions(newPos) {
        // Столкновение со стенами арены
        const bounds = 24;
        newPos.x = Math.max(-bounds, Math.min(bounds, newPos.x));
        newPos.z = Math.max(-bounds, Math.min(bounds, newPos.z));

        // Столкновение с препятствиями
        const obstaclePositions = [
            { x: -8, z: -5, r: 1.2 }, { x: 7, z: -6, r: 1.0 },
            { x: -5, z: 8, r: 1.2 }, { x: 6, z: 7, r: 1.0 },
            { x: -10, z: 10, r: 1.2 }, { x: 10, z: -10, r: 1.3 },
            { x: 0, z: -12, r: 1.0 }, { x: -12, z: -8, r: 1.2 },
            { x: 12, z: 8, r: 1.2 }, { x: -3, z: -3, r: 0.6 },
            { x: 4, z: 4, r: 0.6 }, { x: -6, z: -10, r: 1.0 },
        ];

        for (const obs of obstaclePositions) {
            const dx = newPos.x - obs.x;
            const dz = newPos.z - obs.z;
            const dist = Math.sqrt(dx*dx + dz*dz);
            if (dist < obs.r + 0.3) {
                // Отталкивание
                if (dist > 0.01) {
                    const push = (obs.r + 0.3 - dist) * 0.5;
                    newPos.x += (dx / dist) * push;
                    newPos.z += (dz / dist) * push;
                }
            }
        }

        return newPos;
    }

    _gameLoop() {
        requestAnimationFrame(() => this._gameLoop());

        const delta = Math.min(this.clock.getDelta(), 0.05);

        if (this.gameRunning) {
            this._updatePlayer(delta);
            this._updateEnemies(delta);
            this._updateWave();
        }

        // Вращение частиц
        if (this.particles) {
            this.particles.rotation.y += delta * 0.02;
        }

        this.renderer.render(this.scene, this.camera);
    }

    _updatePlayer(delta) {
        // Ввод с джойстика
        let moveX = this.controls.moveX;
        let moveZ = this.controls.moveZ;

        // Поворот от джойстика прицела
        const lookX = this.controls.lookX;
        const lookY = this.controls.lookY;

        // На ПК — мышь
        if (!this.isMobile && this.isPointerLocked) {
            // Обработка мыши делается через mousemove
        }

        // Обновляем углы обзора
        this.player.yaw -= lookX * 0.5;
        this.player.pitch -= lookY * 0.5;
        this.player.pitch = Math.max(-Math.PI/2.5, Math.min(Math.PI/2.5, this.player.pitch));

        // Применяем поворот к камере
        this.camera.rotation.x = this.player.pitch;
        this.camera.rotation.y = this.player.yaw;

        // Движение
        if (moveX !== 0 || moveZ !== 0) {
            const sin = Math.sin(this.player.yaw);
            const cos = Math.cos(this.player.yaw);

            const forwardX = -sin;
            const forwardZ = -cos;

            const rightX = cos;
            const rightZ = -sin;

            const speed = this.player.speed * (this.keys.shift ? 2 : 1) * delta;

            const newPos = this.player.position.clone();
            newPos.x += (rightX * moveX + forwardX * moveZ) * speed;
            newPos.z += (rightZ * moveX + forwardZ * moveZ) * speed;

            this.player.position.copy(this._checkCollisions(newPos));
        }

        this.camera.position.x = this.player.position.x;
        this.camera.position.z = this.player.position.z;

        // Стрельба
        if (this.controls.shooting) {
            this.shoot();
        }
        this.shootCooldown = Math.max(0, this.shootCooldown - delta);
    }

    _updateEnemies(delta) {
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const enemy = this.enemies[i];
            if (!enemy.alive) continue;

            enemy.update(this.player.position, delta);

            // Проверка на урон игроку (враг коснулся)
            const dx = enemy.getPosition().x - this.player.position.x;
            const dz = enemy.getPosition().z - this.player.position.z;
            const dist = Math.sqrt(dx*dx + dz*dz);

            if (dist < 1.0 && enemy.canDamage()) {
                this._damagePlayer(10);
                enemy.resetDamageCooldown();
            }
        }
    }

    _updateWave() {
        // Спавн врагов с задержкой
        if (this.enemiesSpawned < this.enemiesPerWave) {
            if (this.enemies.length < this.enemiesPerWave + 3) {
                this._spawnEnemyTimer();
            }
        }

        // Проверка завершения волны
        if (this.enemiesSpawned >= this.enemiesPerWave && this.enemies.length === 0 && this.waveActive) {
            this.waveActive = false;
            this.wave++;
            this._updateHUD();

            // Награда
            this.score += 200;
            this.ammo = this.maxAmmo;

            // Показываем сообщение о новой волне
            this._showWaveMessage();

            // Новая волна через 2 секунды
            setTimeout(() => {
                if (this.gameRunning) this._startWave();
            }, 2000);
        }
    }

    _spawnEnemyTimer() {
        if (this._spawnTimeout) return;
        this._spawnTimeout = setTimeout(() => {
            this._spawnTimeout = null;
            this._spawnEnemy();
        }, 500 + Math.random() * 1000);
    }

    _showWaveMessage() {
        const msg = document.createElement('div');
        msg.style.cssText = `
            position: absolute; top: 35%; left: 50%; transform: translate(-50%, -50%);
            color: #ffd700; font-size: 36px; font-weight: bold;
            text-shadow: 0 0 20px rgba(255, 215, 0, 0.6);
            z-index: 30; pointer-events: none;
            text-align: center;
        `;
        msg.textContent = `ВОЛНА ${this.wave}`;
        document.body.appendChild(msg);

        setTimeout(() => {
            msg.style.transition = 'opacity 1s ease';
            msg.style.opacity = '0';
            setTimeout(() => msg.remove(), 1000);
        }, 1500);
    }
}

// ========== Инициализация ==========
let game;

document.addEventListener('DOMContentLoaded', () => {
    game = new Game();

    document.getElementById('start-btn').addEventListener('click', () => {
        game.startGame();
    });

    document.getElementById('restart-btn').addEventListener('click', () => {
        document.getElementById('game-over').classList.add('hidden');
        game.startGame();
    });

    // Обработка мыши для ПК
    document.addEventListener('mousemove', (e) => {
        if (game && game.gameRunning && game.isPointerLocked) {
            game.controls.updateMouseLook(
                e.movementX || 0,
                e.movementY || 0
            );
        }
    });

    // Кнопка стрельбы
    const fireBtn = document.getElementById('fire-btn');
    fireBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (game && game.gameRunning) game.controls.shooting = true;
    }, { passive: false });
    fireBtn.addEventListener('touchend', (e) => {
        e.preventDefault();
        if (game && game.gameRunning) game.controls.shooting = false;
    }, { passive: false });
    fireBtn.addEventListener('mousedown', () => {
        if (game && game.gameRunning) game.controls.shooting = true;
    });
    fireBtn.addEventListener('mouseup', () => {
        if (game && game.gameRunning) game.controls.shooting = false;
    });

    // Блокировка скролла на мобильных
    document.addEventListener('touchmove', (e) => {
        if (e.target.closest('#game-container') ||
            e.target.closest('.joystick-zone') ||
            e.target.closest('#fire-btn')) {
            e.preventDefault();
        }
    }, { passive: false });
});
