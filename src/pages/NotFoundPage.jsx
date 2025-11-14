import { Link } from "react-router-dom"

export default function NotFoundPage() {
  return (
    <>
      <h1>404 Not Found</h1>
      <Link to="/Urtug/">Home</Link>
    </>
  )
}

/**

Diff between Link and <a></a> tag in React:

Link: Client-side routing -- no page refresh
<a>: Page and all related assets (html/css) reloaded

 */
