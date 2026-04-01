import Navbar from './components/Navbar'
import Hero from './components/Hero'
import Education from './components/Education'
import Projects from './components/Projects'
import Skills from './components/Skills'
import Footer from './components/Footer'
import './App.css'

export default function App() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <div className="section-alt">
          <Education />
        </div>
        <Projects />
        <div className="section-alt">
          <Skills />
        </div>
      </main>
      <Footer />
    </>
  )
}
