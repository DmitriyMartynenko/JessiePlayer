export default function Sidebar() {
return (
<aside className="w-64 bg-slate-800 border-r border-slate-700 p-4">
<h1 className="text-xl font-semibold mb-4">Jessie</h1>
<ul className="space-y-2 text-slate-300">
<li className="hover:text-white cursor-pointer">Files</li>
<li className="hover:text-white cursor-pointer">Playlist</li>
<li className="hover:text-white cursor-pointer">Settings</li>
</ul>
</aside>
);
}