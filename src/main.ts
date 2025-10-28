import "./styles.scss";

import type { Sheet } from './sheet';
import { actionMode, idleSheet, rotationMode } from './main-list';

class SpriteAnimator {
  private element: HTMLElement;
  private preloadElement: HTMLElement;
  private spriteSheets: Sheet[];
  private frameWidth: number;
  private frameHeight: number;
  private columns: number;
  private totalFrames: number;
  private currentFrame: number = 0;
  private currentSheetIndex: number = 0;
  private currentSpriteIndex: number = 0;
  private fps: number;
  private intervalId: number | null = null;
  private preloaded: Set<string> = new Set();
  private containerEl: HTMLElement;
  private currentMode: "idle" | "action" | "rotate" = "idle";
  private pendingMode: "idle" | "action" | "rotate" | null = null;

  private isDragging: boolean = false;

  private modeIdle: HTMLElement;
  private modeAction: HTMLElement;
  private modeRotation: HTMLElement;
  private currentEl: HTMLElement;
  private progressEl: HTMLElement;

  constructor(
    spriteSheets: Sheet[],
    frameWidth: number,
    frameHeight: number,
    columns: number,
    fps: number = 24,
    totalFrames: number = 121
  ) {
    this.spriteSheets = spriteSheets;
    this.frameWidth = frameWidth;
    this.frameHeight = frameHeight;
    this.columns = columns;
    this.fps = fps;
    this.totalFrames = totalFrames;

    // Container setup
    this.containerEl = document.createElement("div");
    this.containerEl.classList.add("container");

    this.element = document.createElement("div");
    this.element.classList.add("sprite");
    this.containerEl.appendChild(this.element);

    // Info bar + mode buttons
    const infoEl = document.createElement("div");
    infoEl.classList.add("info");

    this.currentEl = document.createElement("div");
    this.currentEl.id = "current";
    infoEl.appendChild(this.currentEl);

    const remainingEl = document.createElement("div");
    remainingEl.id = "remaining";
    this.progressEl = document.createElement("div");
    this.progressEl.id = "progress";
    remainingEl.appendChild(this.progressEl);
    infoEl.appendChild(remainingEl);

    this.modeIdle = this.makeModeButton("idle");
    this.modeIdle.classList.add("active");
    this.modeAction = this.makeModeButton("action");
    this.modeRotation = this.makeModeButton("rotate");
    const modeWrapper = document.createElement("div");
    modeWrapper.classList.add("modeList");
    modeWrapper.appendChild(this.modeIdle);
    modeWrapper.appendChild(this.modeAction);
    modeWrapper.appendChild(this.modeRotation);
    infoEl.appendChild(modeWrapper);

    document.body.appendChild(this.containerEl);
    document.body.appendChild(infoEl);

    // Preload container
    this.preloadElement = document.createElement("div");
    this.preloadElement.classList.add("preload");
    this.containerEl.appendChild(this.preloadElement);

    // Default startup
    this.setSpriteSheet(0);
    this.preloadAll();
    this.startIdleMode();
  }

  /** Utility to build the buttons */
  private makeModeButton(mode: "idle" | "action" | "rotate"): HTMLElement {
    const btn = document.createElement("a");
    btn.innerHTML = mode;
    btn.href = "#";
    btn.classList.add("modeSelect");
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      this.changeMode(mode);
    });
    return btn;
  }
  public setSpriteGroup(index: number) {
    if (this.currentSpriteIndex === index) return;
    this.currentSpriteIndex = index;

    // Update spriteSheets based on current mode
    switch (this.currentMode) {
      case "idle":
        this.spriteSheets = idleSheet[this.currentSpriteIndex];
        break;
      case "action":
        this.spriteSheets = actionMode[this.currentSpriteIndex];
        break;
      case "rotate":
        this.spriteSheets = rotationMode[this.currentSpriteIndex];
        break;
    }

    // Reset to first sheet of the new group
    this.setSpriteSheet(0);
    this.preloadAll();
  }
  /** Switch between the three modes */
  private changeMode(mode: "idle" | "action" | "rotate") {
    // If currently animating in idle or action, queue the change until end of loop
    if (
      (this.currentMode === "idle" || this.currentMode === "action") &&
      this.intervalId !== null
    ) {
      this.pendingMode = mode;

      // --- add visual feedback ---
      this.modeIdle.classList.remove("pending");
      this.modeAction.classList.remove("pending");
      this.modeRotation.classList.remove("pending");

      if (mode === "idle") this.modeIdle.classList.add("pending");
      else if (mode === "action") this.modeAction.classList.add("pending");
      else if (mode === "rotate") {
        this.modeRotation.classList.add("pending");

        // ✅ Preload rotation sprites while waiting
        const rotationSheets = rotationMode[this.currentSpriteIndex];
        rotationSheets.forEach((sheet) => {
          if (!this.preloaded.has(sheet.url)) {
            const img = new Image();
            img.src = sheet.url;
            img.onload = () => this.preloaded.add(sheet.url);
          }
        });
      }

      return;
    }

    // Proceed with immediate mode change
    this.stop();
    this.pendingMode = null;

    // Clear pending and set active state
    this.modeIdle.classList.remove("pending", "active");
    this.modeAction.classList.remove("pending", "active");
    this.modeRotation.classList.remove("pending", "active");

    this.currentMode = mode;
    this.progressEl.style.width = "0%";

    if (mode === "idle") this.modeIdle.classList.add("active");
    else if (mode === "action") this.modeAction.classList.add("active");
    else if (mode === "rotate") this.modeRotation.classList.add("active");

    switch (mode) {
      case "idle":
        this.spriteSheets = idleSheet[this.currentSpriteIndex];
        this.startIdleMode();
        break;
      case "action":
        this.spriteSheets = actionMode[this.currentSpriteIndex];
        this.startActionMode();
        break;
      case "rotate":
        this.spriteSheets = rotationMode[this.currentSpriteIndex];
        this.startRotateMode();
        break;
    }
  }

  /** IDLE MODE: continuously loops all sheets one after another */
  private startIdleMode() {
    this.currentEl.textContent = "stand-by mode";
    const newIndex = this.pickRandomIndex(this.currentSheetIndex);
    this.setSpriteSheet(newIndex);
    this.currentSheetIndex = newIndex;
    this.preloadAll();
    this.start();
  }

  /** ACTION MODE: plays one random, waits for click */
  private startActionMode() {
    this.currentEl.textContent = "action mode";
    this.currentSheetIndex = this.pickRandomIndex(-1);
    this.setSpriteSheet(this.currentSheetIndex);
    this.preloadAll();
    this.start();
  }

  /** ROTATE MODE: mouse X controls frame position, springs back to frame 0 */
  private startRotateMode() {
    this.currentEl.textContent = "click/drag android to rotate";
    this.spriteSheets = rotationMode[this.currentSpriteIndex];
    this.setSpriteSheet(0);
    this.updateSpriteFrame(0);

    let lastX = 0;
    let frameFloat = 0;
    let returnAnimId: number | null = null;

    const handleMove = (x: number) => {
      if (!this.isDragging || this.currentMode !== "rotate") return;
      const dx = x - lastX;
      lastX = x;
      frameFloat += dx / 5;
      let frame = Math.floor(frameFloat) % this.totalFrames;
      if (frame < 0) frame += this.totalFrames;
      this.updateSpriteFrame(frame);
    };

    const smoothReturn = () => {
      if (this.currentMode !== "rotate") return;
      // smoothly move back toward frame 0
      if (Math.abs(frameFloat) > 0.5) {
        frameFloat *= 0.85; // damping — controls speed of return
        let frame = Math.floor(frameFloat);
        if (frame < 0) frame += this.totalFrames;
        this.updateSpriteFrame(frame);
        returnAnimId = requestAnimationFrame(smoothReturn);
      } else {
        this.updateSpriteFrame(0);
        frameFloat = 0;
        returnAnimId = null;
      }
    };

    const stopDragging = () => {
      this.isDragging = false;
      if (returnAnimId) cancelAnimationFrame(returnAnimId);
      returnAnimId = requestAnimationFrame(smoothReturn);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (this.isDragging && e.touches.length > 0) {
        handleMove(e.touches[0].clientX);
      }
    };

    // --- Mouse controls ---
    this.element.onmousedown = (e) => {
      this.isDragging = true;
      lastX = e.clientX;
      if (returnAnimId) cancelAnimationFrame(returnAnimId);
    };
    window.onmouseup = stopDragging;
    window.onmousemove = (e) => handleMove(e.clientX);

    // --- Touch controls ---
    this.element.ontouchstart = (e) => {
      this.isDragging = true;
      lastX = e.touches[0].clientX;
      if (returnAnimId) cancelAnimationFrame(returnAnimId);
    };
    window.addEventListener("touchmove", handleTouchMove, { passive: true });
    window.addEventListener("touchend", stopDragging, { passive: true });

    // Clean up when leaving rotate mode
    const cleanup = () => {
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", stopDragging);
      window.onmousemove = null;
      window.onmouseup = null;
      if (returnAnimId) cancelAnimationFrame(returnAnimId);
    };

    const origChangeMode = this.changeMode.bind(this);
    this.changeMode = (mode) => {
      cleanup();
      origChangeMode(mode);
    };
  }

  /** Shared: advance frame loop */
  private updateSprite() {
    const col = this.currentFrame % this.columns;
    const row = Math.floor(this.currentFrame / this.columns);
    const xOffset = -(col * this.frameWidth);
    const yOffset = -(row * this.frameHeight);

    this.element.style.backgroundPosition = `${xOffset}px ${yOffset}px`;
    this.currentFrame++;
    if (this.currentEl) {
      this.currentEl.textContent = `${
        this.spriteSheets[this.currentSheetIndex].name
      }`;
    }
    const percent = (this.currentFrame / this.totalFrames) * 100;
    if (this.currentMode !== "rotate")
      this.progressEl.style.width = `${percent}%`;

    if (this.currentFrame >= this.totalFrames) {
      this.currentFrame = 0;

      if (this.pendingMode) {
        const next = this.pendingMode;
        this.pendingMode = null;

        // --- remove pending visuals ---
        this.modeIdle.classList.remove("pending");
        this.modeAction.classList.remove("pending");
        this.modeRotation.classList.remove("pending");

        this.stop();
        this.changeMode(next);
        return;
      }

      if (this.currentMode === "idle") {
        const newIndex = this.pickRandomIndex(this.currentSheetIndex);
        this.setSpriteSheet(newIndex);
        this.currentSheetIndex = newIndex;
      } else if (this.currentMode === "action") {
        const newIndex = this.pickRandomIndex(this.currentSheetIndex);
        this.setSpriteSheet(newIndex);
        this.currentSheetIndex = newIndex;
      }
    }
  }

  private updateSpriteFrame(frame: number) {
    this.currentFrame = frame;
    const col = this.currentFrame % this.columns;
    const row = Math.floor(this.currentFrame / this.columns);
    const xOffset = -(col * this.frameWidth);
    const yOffset = -(row * this.frameHeight);
    this.element.style.backgroundPosition = `${xOffset}px ${yOffset}px`;

    // optional progress feedback
    const percent = (this.currentFrame / this.totalFrames) * 100;
    if (this.currentMode == "action")
      this.progressEl.style.width = `${percent}%`;
  }

  private setSpriteSheet(index: number) {
    this.currentSheetIndex = index;
    const sheet = this.spriteSheets[index];
    this.element.style.backgroundImage = `url(${sheet.url})`;
    this.currentFrame = 0;
  }

  private preloadAll() {
    this.spriteSheets.forEach((_, i) => this.preload(i));
  }

  private pickRandomIndex(exclude: number): number {
    let newIndex: number;
    do {
      newIndex = Math.floor(Math.random() * this.spriteSheets.length);
    } while (newIndex === exclude);
    return newIndex;
  }

  private preload(index: number) {
    const sheet = this.spriteSheets[index];
    if (this.preloaded.has(sheet.url)) return;

    const img = new Image();
    img.src = sheet.url;
    img.onload = () => {
      this.preloaded.add(sheet.url);
      if (this.preloaded.size === this.spriteSheets.length) {
        this.preloadElement.remove();
      }
    };
    this.preloadElement.appendChild(img);
  }

  public start() {
    if (this.intervalId !== null) return;
    this.intervalId = window.setInterval(
      () => this.updateSprite(),
      1000 / this.fps
    );
  }

  public stop() {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}

window.addEventListener("DOMContentLoaded", () => {
  // character/group switch buttons
  const switchList = document.createElement("ul");
  switchList.classList.add("character-list");
  const switchA = document.createElement("button");
  switchA.textContent = "Player 1";
  const switchB = document.createElement("button");
  switchB.textContent = "Player 2";
  const switchC = document.createElement("button");
  switchC.textContent = "Player 3";
  const switchD = document.createElement("button");
  switchD.textContent = "Player 4";
  const switchE = document.createElement("button");
  switchE.textContent = "Player 5";
  switchList.appendChild(switchA);
  switchList.appendChild(switchB);
  switchList.appendChild(switchC);
  switchList.appendChild(switchD);
  switchList.appendChild(switchE);
  document.body.appendChild(switchList);

  switchA.addEventListener("click", () => man1.setSpriteGroup(0));
  switchB.addEventListener("click", () => man1.setSpriteGroup(1));
  switchC.addEventListener("click", () => man1.setSpriteGroup(2));
  switchD.addEventListener("click", () => man1.setSpriteGroup(3));
  switchE.addEventListener("click", () => man1.setSpriteGroup(4));

  const man1 = new SpriteAnimator(idleSheet[0], 213, 320, 5, 24);
  man1.start();
});