import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Copy, ExternalLink, UserPlus, Trash2 } from 'lucide-react';
import { createChannel, getChannels, inviteCollaborator, getCollaborators, removeCollaborator } from '../api/channels';

export default function ChannelDashboard() {
    const [data, setData] = useState({ owned: null, collaborations: [] });
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [collabs, setCollabs] = useState([]);
    const [msg, setMsg] = useState('');

    const load = () => getChannels().then(setData);

    useEffect(() => {
        load();
    }, []);

    useEffect(() => {
        if (data.owned) getCollaborators(data.owned.id).then(setCollabs);
    }, [data.owned]);

    const handleCreateChannel = async () => {
        await createChannel({ name });
        await load();
    };

    const handleInvite = async () => {
        try {
            await inviteCollaborator(data.owned.id, email);
            setMsg('INVITATION SENT');
            setEmail('');
        } catch (error) {
            setMsg(error.response?.data?.message || 'ERROR');
        }
    };

    const handleRemoveCollaborator = async (userId) => {
        await removeCollaborator(data.owned.id, userId);
        setCollabs(current => current.filter(collaborator => collaborator.userId !== userId));
    };

    if (!data.owned) {
        return (
            <div className="dc-dashboard">
                <h1>CREA TU // CANAL DE DRAWCAST</h1>
                <p>Configura el canal que usarás en stream. Recibirás un link único para OBS y otro para el editor.</p>
                <input value={name} onChange={event => setName(event.target.value)} placeholder="Nombre del canal" className='my-5'/>
                <button onClick={handleCreateChannel} className='my-5'>INICIALIZAR CANAL</button>
            </div>
        );
    }

    const channel = data.owned;
    const origin = window.location.origin;
    const editor = `${origin}/editor/${channel.publicKey}`;
    const overlay = `${origin}/overlay/${channel.publicKey}`;

    return (
        <div className="dc-dashboard">
            <header>
                <h1>CANAL // {channel.name}</h1>
            </header>

            <div className="dc-link-card">
                <label>Link del editor</label>
                <code>{editor}</code>
                <button onClick={() => navigator.clipboard.writeText(editor)}><Copy /> COPIAR</button>
                <Link to={`/editor/${channel.publicKey}`}><ExternalLink /> ABRIR</Link>
            </div>

            <div className="dc-link-card">
                <label>Fuente para el OBS // 1920×1080</label>
                <code>{overlay}</code>
                <button onClick={() => navigator.clipboard.writeText(overlay)}><Copy /> COPIAR</button>
            </div>

            <section className="dc-panel">
                <h2>COLABORADORES</h2>
                <div className="dc-invite">
                    <input type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="correo de un usuario registrado" />
                    <button onClick={handleInvite}><UserPlus /> INVITAR</button>
                </div>
                <p>{msg}</p>
                {collabs.map(collaborator => (
                    <div className="dc-collab" key={collaborator.userId}>
                        <span>{collaborator.user?.displayName || collaborator.user?.username} // {collaborator.user?.email}</span>
                        <button onClick={() => handleRemoveCollaborator(collaborator.userId)}><Trash2 /></button>
                    </div>
                ))}
            </section>

            {data.collaborations.length > 0 && (
                <section className="dc-panel">
                    <h2>CANALES COMPARTIDOS CONTIGO</h2>
                    {data.collaborations.map(collaboration => <Link key={collaboration.id} to={`/editor/${collaboration.publicKey}`}>{collaboration.name} // ABRIR EDITOR</Link>)}
                </section>
            )}
        </div>
    );
}
