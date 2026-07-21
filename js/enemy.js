/**
 * Класс врага
 */
class Enemy {
    constructor(scene, position, color = 0xff3333) {
        this.scene = scene;
        this.health = 100;
        this.maxHealth = 100;
        this.speed = 2 + Math.random() * 1.5;
        this.alive = true;
        this.damageCooldown = 0;

        // Создаём группу для врага
        this.group = new THREE.Group();
        this.group.position.copy(position);

        // Тело (куб)
        const bodyGeo = new THREE.BoxGeometry(0.8, 1.0, 0.8);
        const bodyMat = new THREE.MeshPhongMaterial({
            color: color,
            emissive: color,
            emissiveIntensity: 0.2
        });
        this.body = new THREE.Mesh(bodyGeo, bodyMat);
        this.body.position.y = 0.5;
        this.group.add(this.body);

        // Голова — картинка (спрайт), если загружена, иначе сфера
        this.head = null;
        this._loadHeadTexture();

        // Глаза (две маленькие сферы) — поверх картинки для эффекта
        const eyeMat = new THREE.MeshPhongMaterial({ color: 0xffff00, emissive: 0xffff00, emissiveIntensity: 0.5 });
        const eyeGeo = new THREE.SphereGeometry(0.08, 6, 6);
        const eye1 = new THREE.Mesh(eyeGeo, eyeMat);
        eye1.position.set(-0.12, 1.35, -0.3);
        this.group.add(eye1);
        const eye2 = new THREE.Mesh(eyeGeo, eyeMat);
        eye2.position.set(0.12, 1.35, -0.3);
        this.group.add(eye2);

        // Полоска здоровья (Billboard)
        this.healthBarGroup = new THREE.Group();
        const barBgGeo = new THREE.PlaneGeometry(0.8, 0.08);
        const barBgMat = new THREE.MeshBasicMaterial({ color: 0x333333, side: THREE.DoubleSide });
        this.healthBarBg = new THREE.Mesh(barBgGeo, barBgMat);
        this.healthBarGroup.add(this.healthBarBg);

        const barGeo = new THREE.PlaneGeometry(0.8, 0.08);
        const barMat = new THREE.MeshBasicMaterial({ color: 0x44ff44, side: THREE.DoubleSide });
        this.healthBar = new THREE.Mesh(barGeo, barMat);
        this.healthBar.position.z = 0.001;
        this.healthBarGroup.add(this.healthBar);

        this.healthBarGroup.position.y = 1.8;
        this.group.add(this.healthBarGroup);

        scene.add(this.group);
    }

    _loadHeadTexture() {
        // Пробуем загрузить картинку head.png
        const loader = new THREE.TextureLoader();
        const imgUrl = 'img/head.png';

        loader.load(imgUrl, (texture) => {
            texture.needsUpdate = true;

            const spriteMat = new THREE.SpriteMaterial({
                map: texture,
                transparent: true,
                depthTest: true,
                depthWrite: false
            });
            const sprite = new THREE.Sprite(spriteMat);
            sprite.scale.set(0.7, 0.7, 1);
            sprite.position.y = 1.3;

            // Удаляем старую голову (сферу-заглушку)
            if (this.head) {
                this.group.remove(this.head);
                if (this.head.geometry) this.head.geometry.dispose();
                if (this.head.material) this.head.material.dispose();
            }

            this.head = sprite;
            this.group.add(sprite);
        }, undefined, () => {
            // Ошибка загрузки — остаётся сфера-заглушка
        });

        // Сразу создаём сферу-заглушку, пока картинка грузится
        this._createFallbackHead();
    }

    _createFallbackHead() {
        if (this.head && this.head.type !== 'Sprite') return;
        const geo = new THREE.SphereGeometry(0.35, 8, 8);
        const mat = new THREE.MeshPhongMaterial({
            color: 0xff6666,
            emissive: 0xff3333,
            emissiveIntensity: 0.15
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.y = 1.3;
        this.head = mesh;
        this.group.add(mesh);
    }

    takeDamage(damage) {
        if (!this.alive) return false;
        this.health -= damage;

        // Визуальная обратная связь
        this.body.material.emissiveIntensity = 0.8;
        setTimeout(() => {
            if (this.body.material) this.body.material.emissiveIntensity = 0.2;
        }, 100);

        // Обновление полоски здоровья
        const healthPercent = Math.max(0, this.health / this.maxHealth);
        this.healthBar.scale.x = healthPercent;
        this.healthBar.position.x = (1 - healthPercent) * -0.4;

        // Цвет полоски
        if (healthPercent > 0.5) {
            this.healthBar.material.color.setHex(0x44ff44);
        } else if (healthPercent > 0.25) {
            this.healthBar.material.color.setHex(0xffaa00);
        } else {
            this.healthBar.material.color.setHex(0xff4444);
        }

        if (this.health <= 0) {
            this.die();
            return true;
        }
        return false;
    }

    die() {
        this.alive = false;
        // Эффект смерти
        this.body.material.emissive.setHex(0xff0000);
        this.body.material.emissiveIntensity = 1.0;

        // Если голова — сфера (3D), меняем цвет. Спрайт просто гаснет
        if (this.head.type === 'Mesh') {
            this.head.material.emissive.setHex(0xff0000);
        } else if (this.head.type === 'Sprite') {
            this.head.material.opacity = 0.3;
        }

        // Анимация исчезновения
        const startScale = 1;
        const duration = 500;
        const startTime = Date.now();

        const fadeOut = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const scale = startScale * (1 - progress * 0.5);
            this.group.scale.set(scale, scale, scale);
            this.group.position.y = progress * 0.5;

            if (progress < 1) {
                requestAnimationFrame(fadeOut);
            } else {
                this.remove();
            }
        };
        fadeOut();
    }

    remove() {
        if (this.group.parent) {
            this.scene.remove(this.group);
        }
        // Освобождение ресурсов
        this.body.geometry.dispose();
        this.body.material.dispose();
        if (this.head) {
            if (this.head.geometry) this.head.geometry.dispose();
            if (this.head.material) this.head.material.dispose();
        }
    }

    update(playerPosition, deltaTime) {
        if (!this.alive) return;

        this.damageCooldown = Math.max(0, this.damageCooldown - deltaTime);

        // Движение к игроку
        const dx = playerPosition.x - this.group.position.x;
        const dz = playerPosition.z - this.group.position.z;
        const dist = Math.sqrt(dx*dx + dz*dz);

        if (dist > 0.5) {
            const moveX = (dx / dist) * this.speed * deltaTime;
            const moveZ = (dz / dist) * this.speed * deltaTime;
            this.group.position.x += moveX;
            this.group.position.z += moveZ;
        }

        // Поворот к игроку
        const angle = Math.atan2(dx, dz);
        this.group.rotation.y = angle;

        // Покачивание
        this.group.position.y = Math.sin(Date.now() * 0.005) * 0.05;
    }

    getPosition() {
        return this.group.position;
    }

    canDamage() {
        return this.alive && this.damageCooldown <= 0;
    }

    resetDamageCooldown() {
        this.damageCooldown = 1.0; // 1 секунда между уроном
    }
}
