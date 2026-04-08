import HeroSection from "./sections/Hero/HeroSection";
import "./App.css";

export default function App() {
  return (
    <>
      <HeroSection />

      <section id="quickfacts" style={sectionStyle}>
        <h2>Quick Facts</h2>
      </section>

      <section id="skills" style={sectionStyle}>
        <h2>Skills</h2>
      </section>

      <section id="projects" style={sectionStyle}>
        <h2>Projects</h2>
      </section>

      <section id="showcase" style={sectionStyle}>
        <h2>Showcase</h2>
      </section>

      <section id="contact" style={sectionStyle}>
        <h2>Kontakt</h2>
      </section>
    </>
  );
}

const sectionStyle = {
  minHeight: "100vh",
  padding: "80px 24px",
  background: "#0b1220",
  color: "#eaf2ff",
  borderTop: "1px solid rgba(255,255,255,0.08)",
};