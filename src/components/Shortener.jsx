import { useState } from "react"
import PulseLoader from "react-spinners/PulseLoader";

const apiUrl = import.meta.env.VITE_API_URL

export default function Shortener(props) {
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  function handleInputChange(e) {
    const { value } = e.target
    setInput(value)
    if (error && value.trim() !== "") setError(false)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const value = input.trim()
    if (value === "") {
      setError(true)
      return
    }

    setLoading(true)
    try {
      const response = await fetch(`${apiUrl}/shorten`, {
        method: 'POST',
        body: JSON.stringify({ originalUrl: value }),
        headers: {
          "Content-type": "application/json"
        },
        credentials: 'include',
      })

      if (response.status === 404) {
        alert('Unable to reach server')
        setLoading(false)
        return
      }

      const data = await response.json()

      if (!response.ok) {
        alert(data.message || 'Failed to shorten URL')
        setLoading(false)
        return
      }

      const newItem = {
        url: value,
        shortUrl: `${apiUrl}/${data.shortCode}`,
        shortCode: data.shortCode
      }
      props.addLink(newItem)
      setInput("")
      setError(false)
      setLoading(false)
    } catch (err) {
      alert('Server Error')
      setLoading(false)
    }
  }

  const override = {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  }

  return (
    <div id="shorten" className="shorten-wrap">
      <div className="container">
        <div className="shorten-card">
          <form className="shorten-form" onSubmit={handleSubmit} noValidate>
            <div className="shorten-input">
              <div className="input-wrap">
                <input
                  type="url"
                  placeholder="Shorten a link here..."
                  id="input"
                  onChange={handleInputChange}
                  value={input}
                  className={error ? "invalid" : ""}
                  aria-invalid={error ? "true" : "false"}
                />
                <p className={`error-text ${error ? "show" : ""}`}>Please add a link</p>
              </div>
              <button className="btn btn-cta" type="submit" disabled={loading}>
                {loading ? (
                  <PulseLoader
                    color={'white'}
                    cssOverride={override}
                    size={11}
                    aria-label="Loading Spinner"
                    data-testid="loader"
                  />
                ) : 'Shorten it!'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
