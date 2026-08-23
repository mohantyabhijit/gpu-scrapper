import HackathonExplorer from "../components/hackathon-explorer";
import { hackathons } from "../data/hackathons";

export default function Home() {
  return <HackathonExplorer initialHackathons={hackathons} />;
}
