import { Link } from 'react-router-dom';
import { ShieldCheck, KeyRound, UserRound, Activity, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function AppHome() {
  const { user } = useAuth();

  return (
    <div className="mx-auto w-[min(1200px,calc(100%-32px))] py-8 grid gap-4">
      <section className="flex flex-col items-start justify-between gap-5 pb-2 pt-6 md:flex-row md:items-end">
        <div><span className="inline-block text-[11px] font-black uppercase tracking-[.1em] text-zinc-500">Inicio</span>
          <h1>Hola, {user?.displayName || user?.username}</h1>
          <p className="text-zinc-500">Punto de partida inicial.</p>
        </div>
        <Link to="/app/profile" className="inline-flex items-center justify-center gap-2 rounded-md border border-zinc-950 bg-zinc-950 px-3.5 py-2.5 font-extrabold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 bg-white  hover:bg-zinc-100">Ver perfil
        <ArrowRight size={16} />
        </Link>
      </section>
    </div>
  );
}
