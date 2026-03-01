import Shortener from "./Shortener"
import iconBrand from "../images/icon-brand-recognition.svg"
import iconRecords from "../images/icon-detailed-records.svg"
import iconCustom from "../images/icon-fully-customizable.svg"

export default function Main() {
    return <main>
        <Shortener />
        <div className="container">
            {/* Note: The links list now lives on the /links page (protected). */}
        </div>
        <section className="stats">
            <div className="container">
                <h3>Advanced Statistics</h3>
                <p>Track how many clicks your shortened URLs receive and measure their performance.</p>

                <div className="stats-grid">
                    <article className="stat-card">
                        <div className="stat-icon">
                            <img src={iconBrand} alt="Brand recognition icon" width="32" height="32" />
                        </div>
                        <h4>Brand Recognition</h4>
                        <p>Boost your brand recognition with each click. Generic links don’t mean a thing.
                           Branded links help instill confidence in your content.</p>
                    </article>

                    <article className="stat-card">
                        <div className="stat-icon">
                            <img src={iconRecords} alt="Detailed records icon" width="32" height="32" />
                        </div>
                        <h4>Detailed Records</h4>
                        <p>Gain insights into who is clicking your links. Knowing when and where people engage
                           with your content helps you make better decisions.</p>
                    </article>

                    <article className="stat-card">
                        <div className="stat-icon">
                            <img src={iconCustom} alt="Fully customizable icon" width="32" height="32" />
                        </div>
                        <h4>Fully Customizable</h4>
                        <p>Improve brand awareness and discoverability through customizable links, supercharging
                           audience engagement.</p>
                    </article>
                </div>
            </div>
        </section>
        {/* <CallToAction /> */}
    </main>
}