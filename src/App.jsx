import { HashRouter, Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import Hero from './components/Hero'
import Education from './components/Education'
import Skills from './components/Skills'
import Footer from './components/Footer'
import ProjectDetail from './components/ProjectDetail'
import ListPage from './components/ListPage'
import HomeSection from './components/HomeSection'
import blogTaxonomy from '../content/blog-taxonomy'
import './App.css'

const projectFiles = import.meta.glob('../content/projects/*.md', { query: '?raw', import: 'default', eager: true })
const blogFiles = import.meta.glob('../content/blog/*.md', { query: '?raw', import: 'default', eager: true })

const HOME_PREVIEW_COUNT = 3

function HomePage() {
  return (
    <>
      <Hero />
      <Education />
      <HomeSection
        id="projects"
        alt
        heading="Selected Works"
        files={projectFiles}
        basePath="/works"
        linkLabel="View Project →"
        moreLabel="View All Works"
        limit={HOME_PREVIEW_COUNT}
      />
      <HomeSection
        id="blog"
        heading="Blog"
        files={blogFiles}
        basePath="/blog"
        linkLabel="View Post →"
        moreLabel="View All Posts"
        limit={HOME_PREVIEW_COUNT}
        sortByDate
      />
      <Skills />
    </>
  )
}

export default function App() {
  return (
    <HashRouter>
      <Navbar />
      <main>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/works" element={
            <ListPage files={projectFiles} basePath="/works" heading="Selected Works" />
          } />
          <Route path="/blog" element={
            <ListPage files={blogFiles} basePath="/blog" heading="blog" description="学习笔记与日常记录 / Notes & Diary" taxonomy={blogTaxonomy} />
          } />
          <Route path="/projects/:slug" element={<ProjectDetail source="projects" />} />
          <Route path="/works/:slug" element={<ProjectDetail source="projects" />} />
          <Route path="/blog/:slug" element={<ProjectDetail source="blog" />} />
        </Routes>
      </main>
      <Footer />
    </HashRouter>
  )
}
