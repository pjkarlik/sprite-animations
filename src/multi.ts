import "./styles.scss";
import type { Sheet } from './sheet';
import { sheet1, sheet2, sheet3, sheet4, sheet5} from'./multi-list';

class SpriteAnimator {
  private element: HTMLElement;
  private containerEl: HTMLElement;
  private preloadElement: HTMLElement;
  private spriteSheets: Sheet[];
  private frameWidth: number;
  private frameHeight: number;
  private columns: number;
  private totalFrames: number;
  private currentFrame: number = 0;
  private currentSheetIndex: number = 0;
  private nextSheetIndex: number = 0;
  private fps: number;
  private intervalId: number | null = null;
  private preloaded: Set<string> = new Set();

  constructor(
    spriteSheets: Sheet[],
    frameWidth: number,
    frameHeight: number,
    columns: number,
    fps: number = 24,
    totalFrames: number = 121,
    classString?: string
  ) {
    this.spriteSheets = spriteSheets;
    this.frameWidth = frameWidth;
    this.frameHeight = frameHeight;
    this.columns = columns;
    this.fps = fps;
    this.totalFrames = totalFrames;

    this.containerEl = document.createElement("div");
    if (classString) {
      this.containerEl.classList.add(classString);
    }

    this.containerEl.classList.add("container");

    this.element = document.createElement("div");
    this.element.classList.add("sprite");
    this.element.id = "sprite";
    this.containerEl.appendChild(this.element);

    const wrapperEl = document.getElementById("body-wrapper")!;
    wrapperEl.appendChild(this.containerEl);

    // document.body.appendChild(this.containerEl);

    this.preloadElement = document.createElement("div");
    this.preloadElement.classList.add("preload");
    this.containerEl.appendChild(this.preloadElement);

    this.setSpriteSheet(Math.floor(Math.random() * 5));
    this.currentFrame = Math.floor(Math.random() * this.totalFrames);
    this.nextSheetIndex = this.pickRandomIndex(0);
    this.preload(this.nextSheetIndex);
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

  private setSpriteSheet(index: number) {
    this.currentSheetIndex = index;
    this.element.style.backgroundImage = `url(${this.spriteSheets[index].url})`;
    this.currentFrame = 0;
  }

  private updateSprite() {
    const frameIndex = this.currentFrame;
    const col = frameIndex % this.columns;
    const row = Math.floor(frameIndex / this.columns);

    const xOffset = -(col * this.frameWidth);
    const yOffset = -(row * this.frameHeight);

    this.element.style.backgroundPosition = `${xOffset}px ${yOffset}px`;
    this.currentFrame++;

    if (this.currentFrame >= this.totalFrames) {
      this.setSpriteSheet(this.nextSheetIndex);
      this.element.style.backgroundPosition = "0px 0px";

      const upcoming = this.pickRandomIndex(this.currentSheetIndex);
      this.nextSheetIndex = upcoming;
      this.preload(this.nextSheetIndex);
    }
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
  const man1 = new SpriteAnimator(sheet5, 213, 320, 5, 26);
  man1.start();
  const man2 = new SpriteAnimator(sheet2, 213, 320, 5, 26);
  man2.start();
  const man3 = new SpriteAnimator(sheet1, 213, 320, 5, 26);
  man3.start();
  const man4 = new SpriteAnimator(sheet4, 213, 320, 5, 26);
  man4.start();
  const man5 = new SpriteAnimator(sheet3, 213, 320, 5, 26);
  man5.start();
});
