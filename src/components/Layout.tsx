import Sidebar from "./Sidebar";
import PlayerArea from "./PlayerArea";


export default function Layout() {
return (
<div className="flex h-screen w-screen overflow-hidden">
<Sidebar />
<PlayerArea />
</div>
);
}