import { useEffect, useRef } from "react";
import "./HeroSection.css";

export default function HeroSection() {
  const heroRef = useRef(null);
  const copyRef = useRef(null);

  useEffect(() => {
    const hero = heroRef.current;
    const copy = copyRef.current;

    if (!hero || !copy) return;

    const updatePointerVars = (e) => {
      const heroRect = hero.getBoundingClientRect();
      const copyRect = copy.getBoundingClientRect();

      const heroX = ((e.clientX - heroRect.left) / heroRect.width) * 100;
      const heroY = ((e.clientY - heroRect.top) / heroRect.height) * 100;

      const copyX = e.clientX - copyRect.left;
      const copyY = e.clientY - copyRect.top;

      hero.style.setProperty("--mouse-x", `${heroX}%`);
      hero.style.setProperty("--mouse-y", `${heroY}%`);

      copy.style.setProperty("--copy-mouse-x", `${copyX}px`);
      copy.style.setProperty("--copy-mouse-y", `${copyY}px`);
    };

    hero.addEventListener("pointermove", updatePointerVars);

    return () => {
      hero.removeEventListener("pointermove", updatePointerVars);
    };
  }, []);

  return (
    <section className="hero" id="hero" ref={heroRef}>
      <div className="hero-inner">
        <div className="hero-badge-row">
          <span className="hero-badge">Available for work</span>
          <span className="hero-badge">Frontend + Fullstack</span>
          <span className="hero-badge">CAD + Creative Tech</span>
        </div>

        <div className="hero-stage">
          <div className="hero-copy-wrap" ref={copyRef}>
            <div className="hero-copy">
              <div className="hero-line hero-line-1">Dustin</div>

              <div className="hero-line hero-line-2">
                <span className="hero-builds">builds</span>{" "}
                <span
                  className="hero-digital chromatic-word"
                  data-text="digital"
                  aria-label="digital"
                >
                  digital
                </span>
              </div>

              <div className="hero-line hero-line-3">Experiences.</div>
            </div>

            <div className="hero-copy hero-copy-negative" aria-hidden="true">
              <div className="hero-line hero-line-1">Dustin</div>

              <div className="hero-line hero-line-2">
                <span className="hero-builds">builds</span>{" "}
                <span className="hero-digital">digital</span>
              </div>

              <div className="hero-line hero-line-3">Experiences.</div>
            </div>

            <div className="hero-copy hero-copy-stroke" aria-hidden="true">
              <div className="hero-line hero-line-1">Dustin</div>

              <div className="hero-line hero-line-2">
                <span className="hero-builds">builds</span>{" "}
                <span className="hero-digital">digital</span>
              </div>

              <div className="hero-line hero-line-3">Experiences.</div>
            </div>
          </div>
        </div>

        <div className="hero-scroll">
          <span>Scroll to explore</span>
          <div className="hero-scroll-line" />
        </div>

        <div className="hero-ui-negative" aria-hidden="true">
          <div className="hero-badge-row">
            <span className="hero-badge">Available for work</span>
            <span className="hero-badge">Frontend + Fullstack</span>
            <span className="hero-badge">CAD + Creative Tech</span>
          </div>

          <div className="hero-scroll">
            <span>Scroll to explore</span>
            <div className="hero-scroll-line" />
          </div>
        </div>
      </div>
    </section>
  );
}