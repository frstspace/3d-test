/**
 * Управление: джойстики для мобильных устройств + клавиатура для ПК
 */
class GameControls {
    constructor() {
        // Состояние движения
        this.moveX = 0;
        this.moveZ = 0;
        this.lookX = 0;
        this.lookY = 0;
        this.shooting = false;

        // Джойстик движения
        this.moveJoystick = { active: false, touchId: -1, baseX: 0, baseY: 0, dx: 0, dy: 0 };
        // Джойстик прицела
        this.lookJoystick = { active: false, touchId: -1, baseX: 0, baseY: 0, dx: 0, dy: 0, lastX: 0, lastY: 0 };

        // Клавиатура
        this.keys = { w: false, a: false, s: false, d: false, shift: false };

        this._setupKeyboard();
        this._setupTouch();
    }

    _setupKeyboard() {
        window.addEventListener('keydown', (e) => {
            const key = e.key.toLowerCase();
            if (key === 'w' || key === 'a' || key === 's' || key === 'd') {
                this.keys[key] = true;
            }
            if (key === 'shift') this.keys.shift = true;
            if (key === ' ' || key === 'Enter') {
                e.preventDefault();
                this.shooting = true;
            }
            this._updateFromKeyboard();
        });

        window.addEventListener('keyup', (e) => {
            const key = e.key.toLowerCase();
            if (key === 'w' || key === 'a' || key === 's' || key === 'd') {
                this.keys[key] = false;
            }
            if (key === 'shift') this.keys.shift = false;
            if (key === ' ' || key === 'Enter') {
                e.preventDefault();
                this.shooting = false;
            }
            this._updateFromKeyboard();
        });
    }

    _updateFromKeyboard() {
        this.moveX = 0;
        this.moveZ = 0;
        if (this.keys.w) this.moveZ = 1;
        if (this.keys.s) this.moveZ = -1;
        if (this.keys.a) this.moveX = -1;
        if (this.keys.d) this.moveX = 1;
    }

    _setupTouch() {
        const leftZone = document.getElementById('joystick-left-zone');
        const rightZone = document.getElementById('joystick-right-zone');

        // Создаём визуальные элементы джойстиков
        this.moveBase = this._createJoystickBase('move');
        this.lookBase = this._createJoystickBase('look');
        // Добавляем в body, чтобы position:fixed работал от окна
        document.body.appendChild(this.moveBase);
        document.body.appendChild(this.lookBase);
        // Сразу показываем (стрелки видны всегда)
        this.moveBase.classList.add('active');
        this.lookBase.classList.add('active');

        // Позиции по умолчанию (из CSS)
        this.moveDefaultX = 20;
        this.moveDefaultY = null; // будет вычислено
        this.lookDefaultX = null;
        this.lookDefaultY = null;

        // Обработчики касаний для левой зоны (движение)
        leftZone.addEventListener('touchstart', (e) => this._onTouchStart(e, 'move'), { passive: true });
        leftZone.addEventListener('touchmove', (e) => this._onTouchMove(e, 'move'), { passive: true });
        leftZone.addEventListener('touchend', (e) => this._onTouchEnd(e, 'move'), { passive: true });
        leftZone.addEventListener('touchcancel', (e) => this._onTouchEnd(e, 'move'), { passive: true });

        // Обработчики касаний для правой зоны (прицел)
        rightZone.addEventListener('touchstart', (e) => this._onTouchStart(e, 'look'), { passive: true });
        rightZone.addEventListener('touchmove', (e) => this._onTouchMove(e, 'look'), { passive: true });
        rightZone.addEventListener('touchend', (e) => this._onTouchEnd(e, 'look'), { passive: true });
        rightZone.addEventListener('touchcancel', (e) => this._onTouchEnd(e, 'look'), { passive: true });
    }
    }

    _createJoystickBase(type) {
        const base = document.createElement('div');
        base.className = `joystick-base joystick-${type}`;

        if (type === 'move') {
            // Стрелки направления для левого джойстика
            const arrows = [
                { dir: 'up', text: '▲', x: '50%', y: '8%' },
                { dir: 'down', text: '▼', x: '50%', y: '84%' },
                { dir: 'left', text: '◄', x: '8%', y: '46%' },
                { dir: 'right', text: '►', x: '84%', y: '46%' },
            ];
            arrows.forEach(a => {
                const el = document.createElement('div');
                el.className = `joystick-arrow joystick-arrow-${a.dir}`;
                el.textContent = a.text;
                base.appendChild(el);
            });
        }

        const thumb = document.createElement('div');
        thumb.className = `joystick-thumb joystick-thumb-${type}`;
        base.appendChild(thumb);
        return base;
    }

    _onTouchStart(e, type) {
        const touch = e.changedTouches[0];
        const joystick = type === 'move' ? this.moveJoystick : this.lookJoystick;

        if (joystick.active) return;
        joystick.active = true;
        joystick.tickId = Date.now();
        joystick.touchId = touch.identifier;
        joystick.baseX = touch.clientX;
        joystick.baseY = touch.clientY;
        joystick.dx = 0;
        joystick.dy = 0;

        const base = type === 'move' ? this.moveBase : this.lookBase;
        base.style.transition = 'none';

        if (type === 'look') {
            this.lookJoystick.lastX = touch.clientX;
            this.lookJoystick.lastY = touch.clientY;
        }

        // Сброс позиции thumb в центр
        const thumbEl = base.querySelector(`.joystick-thumb-${type}`);
        if (thumbEl) thumbEl.style.transform = 'translate(-50%, -50%)';
    }

    _onTouchMove(e, type) {
        const joystick = type === 'move' ? this.moveJoystick : this.lookJoystick;
        if (!joystick.active) return;

        let touch = null;
        for (let i = 0; i < e.changedTouches.length; i++) {
            if (e.changedTouches[i].identifier === joystick.touchId) {
                touch = e.changedTouches[i];
                break;
            }
        }
        if (!touch) return;

        const dx = touch.clientX - joystick.baseX;
        const dy = touch.clientY - joystick.baseY;
        const maxDist = 50;
        const dist = Math.min(Math.sqrt(dx*dx + dy*dy), maxDist);
        const angle = Math.atan2(dy, dx);

        const clampedDx = Math.cos(angle) * dist;
        const clampedDy = Math.sin(angle) * dist;

        joystick.dx = clampedDx / maxDist;
        joystick.dy = clampedDy / maxDist;

        if (type === 'move') {
            this.moveX = joystick.dx;
            this.moveZ = -joystick.dy;
        } else {
            // Для прицела используем дельта-движение
            this.lookX = (touch.clientX - this.lookJoystick.lastX) * 0.01;
            this.lookY = (touch.clientY - this.lookJoystick.lastY) * 0.01;
            this.lookJoystick.lastX = touch.clientX;
            this.lookJoystick.lastY = touch.clientY;
        }

        // Визуал
        const base = type === 'move' ? this.moveBase : this.lookBase;
        const thumb = base.querySelector(`.joystick-thumb-${type}`);
        if (thumb) {
            thumb.style.transform = `translate(calc(-50% + ${clampedDx}px), calc(-50% + ${clampedDy}px))`;
        }
    }

    _onTouchEnd(e, type) {
        const joystick = type === 'move' ? this.moveJoystick : this.lookJoystick;
        if (!joystick.active) return;

        let touchEnded = false;
        for (let i = 0; i < e.changedTouches.length; i++) {
            if (e.changedTouches[i].identifier === joystick.touchId) {
                touchEnded = true;
                break;
            }
        }
        if (!touchEnded) return;

        joystick.active = false;
        joystick.touchId = -1;
        joystick.dx = 0;
        joystick.dy = 0;

        const base = type === 'move' ? this.moveBase : this.lookBase;
        // Плавно возвращаем thumb в центр
        const thumbEl = base.querySelector(`.joystick-thumb-${type}`);
        if (thumbEl) {
            thumbEl.style.transition = 'transform 0.15s ease';
            thumbEl.style.transform = 'translate(-50%, -50%)';
            setTimeout(() => { thumbEl.style.transition = 'none'; }, 200);
        }

        if (type === 'move') {
            this.moveX = 0;
            this.moveZ = 0;
        } else {
            this.lookX = 0;
            this.lookY = 0;
            this.shooting = false;
        }
    }

    // Для ПК: обновление прицела мышью (вызывается из game.js)
    updateMouseLook(mx, my) {
        // Масштабируем пиксельные значения мыши в радианы
        this.lookX = mx * 0.003;
        this.lookY = my * 0.003;
    }

    reset() {
        this.moveX = 0;
        this.moveZ = 0;
        this.lookX = 0;
        this.lookY = 0;
        this.shooting = false;
        this.moveJoystick.active = false;
        this.lookJoystick.active = false;
        this.moveBase.classList.remove('active');
        this.lookBase.classList.remove('active');
    }
}
