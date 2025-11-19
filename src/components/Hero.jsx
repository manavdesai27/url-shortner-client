import heroImage from '../images/illustration-working.svg'

export default function Hero() {
  return (
    <section className="hero">
      <div className="container hero-inner">
        <picture className="hero-image">
          <img src={heroImage} alt="Person working illustration" />
        </picture>
        <div className="hero-copy">
          <h1 className="hero-title">Make your URL easy to share</h1>
          <p className="hero-subtitle">
            Shortening your URL makes it easier to share on social media, email, text messages and more.  
            Try it out below and see for yourself.
          </p>
          {/* <div style={{ marginTop: '24px' }}>
            <a className="btn btn--primary" href="#shorten">Get Started</a>
          </div> */}
        </div>
      </div>
    </section>
  )
}
