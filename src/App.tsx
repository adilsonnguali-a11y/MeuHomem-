import React, { useState, useEffect, Component, ReactNode } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useNavigate, useLocation, useParams } from 'react-router-dom';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { doc, getDoc, onSnapshot, collection, query, where, limit, orderBy, updateDoc, setDoc, addDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './firebase';
import { User, EscortProfile, UserType, Report, UserStatus, VerificationStatus, BodyType, ReportStatus, Message } from './types';
import { Search, User as UserIcon, MessageSquare, Heart, Shield, LogOut, Menu, X, Star, CheckCircle, ShieldAlert, Instagram, Facebook, Phone, Calendar, MapPin, Ruler, Weight, Eye, Send, Image as ImageIcon, Camera } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Utility for tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Error Handling ---

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

class ErrorBoundary extends Component<any, any> {
  state: any;
  props: any;

  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  render() {
    const { hasError, error } = this.state;
    if (hasError) {
      let message = "Ocorreu um erro inesperado.";
      try {
        const parsed = JSON.parse(error.message);
        if (parsed.error.includes('insufficient permissions')) {
          message = "Erro de permissão: Você não tem autorização para realizar esta ação.";
        }
      } catch (e) {
        message = error?.message || message;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-bg-main p-4">
          <div className="card p-8 max-w-md w-full text-center space-y-4">
            <ShieldAlert className="w-12 h-12 text-alert mx-auto" />
            <h2 className="text-xl font-bold">Ops! Algo correu mal</h2>
            <p className="text-text-sub text-sm">{message}</p>
            <button 
              onClick={() => window.location.reload()} 
              className="btn-primary w-full py-2"
            >
              Recarregar Página
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// --- Components ---

const Navbar = ({ user, onLogin, onLogout }: { user: User | null, onLogin: () => void, onLogout: () => void }) => {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();

  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    // Simple query for unread messages where user is receiver
    const q = query(
      collection(db, 'messages'), // This would need a better structure for global unread, but for demo:
      where('receiverId', '==', user.id),
      where('isRead', '==', false)
    );
    // Note: The current chat structure is subcollections, so global unread is harder.
    // We'll mock it for now or just show a static dot if messages exists.
  }, [user]);

  const navLinks = [
    { name: 'Início', path: '/', icon: Search },
    { name: 'Favoritos', path: '/favorites', icon: Heart, hide: !user || user.type !== 'client' },
    { name: 'Mensagens', path: '/messages', icon: MessageSquare, hide: !user, badge: true },
    { name: 'Verificação', path: '/verification', icon: Shield, hide: !user || user.type !== 'escort' },
    { name: 'Admin', path: '/admin', icon: Shield, hide: !user || user.type !== 'admin' },
  ];

  return (
    <nav className="bg-nav-bg text-white sticky top-0 z-50 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center space-x-2">
            <span className="text-primary font-bold text-xl tracking-tight">MeuHomem</span>
          </Link>

          <div className="hidden md:block">
            <div className="ml-10 flex items-baseline space-x-4">
              {navLinks.filter(link => !link.hide).map((link) => (
                <Link
                  key={link.name}
                  to={link.path}
                  className={cn(
                    "nav-link flex items-center space-x-1 px-3 py-2 rounded-md text-sm font-medium relative",
                    location.pathname === link.path && "active text-primary"
                  )}
                >
                  <link.icon className="w-4 h-4" />
                  <span>{link.name}</span>
                  {link.badge && (
                    <span className="absolute top-1 right-1 w-2 h-2 bg-primary rounded-full border border-nav-bg"></span>
                  )}
                </Link>
              ))}
              {user ? (
                <div className="flex items-center space-x-4 ml-4">
                  <Link to="/profile" className="flex items-center space-x-2 text-sm font-medium hover:text-primary transition-colors">
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center border border-primary/30">
                      <UserIcon className="w-4 h-4 text-primary" />
                    </div>
                    <span>{user.name}</span>
                  </Link>
                  <button onClick={onLogout} className="text-inactive hover:text-alert transition-colors">
                    <LogOut className="w-5 h-5" />
                  </button>
                </div>
              ) : (
                <button onClick={onLogin} className="btn-primary text-sm">Entrar</button>
              )}
            </div>
          </div>

          <div className="md:hidden">
            <button onClick={() => setIsOpen(!isOpen)} className="text-inactive hover:text-white">
              {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-nav-bg border-t border-white/5"
          >
            <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
              {navLinks.filter(link => !link.hide).map((link) => (
                <Link
                  key={link.name}
                  to={link.path}
                  onClick={() => setIsOpen(false)}
                  className={cn(
                    "flex items-center space-x-2 px-3 py-2 rounded-md text-base font-medium",
                    location.pathname === link.path ? "text-primary bg-white/5" : "text-inactive"
                  )}
                >
                  <link.icon className="w-5 h-5" />
                  <span>{link.name}</span>
                </Link>
              ))}
              {user ? (
                <>
                  <Link to="/profile" onClick={() => setIsOpen(false)} className="flex items-center space-x-2 px-3 py-2 text-inactive font-medium">
                    <UserIcon className="w-5 h-5" />
                    <span>Meu Perfil</span>
                  </Link>
                  <button onClick={() => { onLogout(); setIsOpen(false); }} className="w-full text-left flex items-center space-x-2 px-3 py-2 text-alert font-medium">
                    <LogOut className="w-5 h-5" />
                    <span>Sair</span>
                  </button>
                </>
              ) : (
                <button onClick={() => { onLogin(); setIsOpen(false); }} className="w-full btn-primary mt-2">Entrar</button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

// --- Pages ---

const HomePage = () => {
  const [escorts, setEscorts] = useState<EscortProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [city, setCity] = useState('');

  const cities = ['Luanda', 'Benguela', 'Lubango', 'Huambo', 'Lobito', 'Soyo'];

  useEffect(() => {
    const q = query(collection(db, 'escort_profiles'), where('verified', '==', 'verified'), limit(20));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as EscortProfile));
      setEscorts(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'escort_profiles');
    });
    return () => unsubscribe();
  }, []);

  const filteredEscorts = escorts.filter(e => 
    (e.artisticName.toLowerCase().includes(search.toLowerCase()) || e.city.toLowerCase().includes(search.toLowerCase())) &&
    (city === '' || e.city === city)
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8 space-y-4">
        <h1 className="text-3xl font-bold text-text-main">Encontre a sua companhia ideal</h1>
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-inactive w-5 h-5" />
            <input
              type="text"
              placeholder="Pesquisar por nome ou cidade..."
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-black/5 bg-white shadow-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            className="px-4 py-3 rounded-xl border border-black/5 bg-white shadow-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all min-w-[200px]"
            value={city}
            onChange={(e) => setCity(e.target.value)}
          >
            <option value="">Todas as cidades</option>
            {cities.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredEscorts.map((escort) => (
            <Link key={escort.id} to={`/escort/${escort.id}`} className="card group hover:shadow-md transition-all">
              <div className="aspect-[3/4] bg-gray-200 relative overflow-hidden">
                <img
                  src={`https://picsum.photos/seed/${escort.id}/600/800`}
                  alt={escort.artisticName}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute top-3 right-3">
                  {escort.verified === 'verified' && (
                    <div className="bg-verified text-white text-[10px] font-bold px-2 py-1 rounded-full flex items-center space-x-1 shadow-sm">
                      <CheckCircle className="w-3 h-3" />
                      <span>VERIFICADO</span>
                    </div>
                  )}
                </div>
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4">
                  <h3 className="text-white font-bold text-lg">{escort.artisticName}</h3>
                  <p className="text-white/80 text-sm">{escort.city} • {escort.age} anos</p>
                </div>
              </div>
              <div className="p-4 flex justify-between items-center">
                <div className="flex items-center space-x-1 text-primary">
                  <Star className="w-4 h-4 fill-current" />
                  <span className="font-bold">{escort.rating.toFixed(1)}</span>
                </div>
                <span className="text-text-sub text-xs uppercase tracking-wider font-semibold">{escort.bodyType}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

const EscortProfilePage = ({ user }: { user: User | null }) => {
  const { id } = useParams();
  const [escort, setEscort] = useState<EscortProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    const unsubscribe = onSnapshot(doc(db, 'escort_profiles', id), (snapshot) => {
      if (snapshot.exists()) {
        setEscort({ id: snapshot.id, ...snapshot.data() } as EscortProfile);
      }
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `escort_profiles/${id}`);
    });
    return () => unsubscribe();
  }, [id]);

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>;
  if (!escort) return <div className="text-center py-20 text-text-sub">Perfil não encontrado.</div>;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left: Photos */}
        <div className="lg:col-span-2 space-y-4">
          <div className="card aspect-[3/4] relative">
            <img
              src={`https://picsum.photos/seed/${escort.id}/1200/1600`}
              alt={escort.artisticName}
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
            {escort.verified === 'verified' && (
              <div className="absolute top-4 right-4 bg-verified text-white px-3 py-1.5 rounded-full flex items-center space-x-2 shadow-lg font-bold text-sm">
                <CheckCircle className="w-4 h-4" />
                <span>VERIFICADO</span>
              </div>
            )}
          </div>
          <div className="grid grid-cols-4 gap-2">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="card aspect-square">
                <img
                  src={`https://picsum.photos/seed/${escort.id}-${i}/400/400`}
                  alt={`${escort.artisticName} ${i}`}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Right: Info */}
        <div className="space-y-6">
          <div className="card p-6 space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-3xl font-bold text-text-main">{escort.artisticName}</h1>
                <p className="text-text-sub flex items-center space-x-1">
                  <MapPin className="w-4 h-4" />
                  <span>{escort.city}</span>
                </p>
              </div>
              <div className="flex items-center space-x-1 text-primary bg-primary/10 px-3 py-1 rounded-full">
                <Star className="w-4 h-4 fill-current" />
                <span className="font-bold text-lg">{escort.rating.toFixed(1)}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 py-4 border-y border-black/5">
              <div className="flex items-center space-x-2 text-sm">
                <Calendar className="w-4 h-4 text-inactive" />
                <span className="text-text-sub">Idade:</span>
                <span className="font-semibold">{escort.age} anos</span>
              </div>
              <div className="flex items-center space-x-2 text-sm">
                <Ruler className="w-4 h-4 text-inactive" />
                <span className="text-text-sub">Altura:</span>
                <span className="font-semibold">{escort.height || '--'} m</span>
              </div>
              <div className="flex items-center space-x-2 text-sm">
                <Weight className="w-4 h-4 text-inactive" />
                <span className="text-text-sub">Peso:</span>
                <span className="font-semibold">{escort.weight || '--'} kg</span>
              </div>
              <div className="flex items-center space-x-2 text-sm">
                <UserIcon className="w-4 h-4 text-inactive" />
                <span className="text-text-sub">Físico:</span>
                <span className="font-semibold capitalize">{escort.bodyType}</span>
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="font-bold text-sm uppercase tracking-wider text-inactive">Sobre mim</h3>
              <p className="text-text-main leading-relaxed">{escort.bio || 'Sem biografia disponível.'}</p>
            </div>

            <div className="space-y-3 pt-4">
              <Link to={`/chat/${escort.id}`} className="w-full btn-primary py-4 flex items-center justify-center space-x-2 text-lg">
                <MessageSquare className="w-5 h-5" />
                <span>Enviar Mensagem</span>
              </Link>
              <div className="flex gap-2">
                <button className="flex-1 btn-secondary py-3 flex items-center justify-center space-x-2">
                  <Heart className="w-5 h-5" />
                  <span>Favorito</span>
                </button>
                <button className="px-4 py-3 rounded-lg border border-alert text-alert hover:bg-alert/5 transition-colors">
                  <ShieldAlert className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          <div className="card p-6 space-y-4">
            <h3 className="font-bold text-sm uppercase tracking-wider text-inactive">Redes Sociais</h3>
            <div className="flex space-x-4">
              {escort.socialLinks?.instagram && (
                <a href={`https://instagram.com/${escort.socialLinks.instagram}`} target="_blank" rel="noreferrer" className="flex items-center space-x-2 text-text-main hover:text-primary transition-colors">
                  <Instagram className="w-5 h-5" />
                  <span>Instagram</span>
                </a>
              )}
              {escort.socialLinks?.facebook && (
                <a href={`https://facebook.com/${escort.socialLinks.facebook}`} target="_blank" rel="noreferrer" className="flex items-center space-x-2 text-text-main hover:text-primary transition-colors">
                  <Facebook className="w-5 h-5" />
                  <span>Facebook</span>
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const RoleSelection = ({ onSelect }: { onSelect: (type: UserType) => void }) => {
  return (
    <div className="max-w-md mx-auto mt-20 p-8 card text-center space-y-6">
      <h2 className="text-2xl font-bold">Bem-vindo ao MeuHomem</h2>
      <p className="text-text-sub">Como deseja utilizar a plataforma?</p>
      <div className="grid grid-cols-1 gap-4">
        <button
          onClick={() => onSelect('escort')}
          className="btn-primary py-4 text-lg flex flex-col items-center"
        >
          <span className="font-bold">Sou Acompanhante</span>
          <span className="text-xs opacity-80">Quero oferecer meus serviços</span>
        </button>
        <button
          onClick={() => onSelect('client')}
          className="btn-secondary py-4 text-lg flex flex-col items-center"
        >
          <span className="font-bold">Procuro Acompanhante</span>
          <span className="text-xs opacity-80">Quero encontrar companhia</span>
        </button>
      </div>
    </div>
  );
};

const ChatPage = ({ user }: { user: User | null }) => {
  const { id: otherUserId } = useParams();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [otherUser, setOtherUser] = useState<User | null>(null);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user || !otherUserId) return;
    const chatId = [user.id, otherUserId].sort().join('_');
    
    getDoc(doc(db, 'users', otherUserId)).then(snap => {
      if (snap.exists()) setOtherUser(snap.data() as User);
    }).catch(error => {
      handleFirestoreError(error, OperationType.GET, `users/${otherUserId}`);
    });

    const q = query(
      collection(db, `chats/${chatId}/messages`),
      orderBy('createdAt', 'asc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message)));
      setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `chats/${chatId}/messages`);
    });

    return () => unsubscribe();
  }, [user, otherUserId]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !otherUserId || !newMessage.trim()) return;
    const chatId = [user.id, otherUserId].sort().join('_');

    try {
      await addDoc(collection(db, `chats/${chatId}/messages`), {
        senderId: user.id,
        receiverId: otherUserId,
        content: newMessage,
        isRead: false,
        isReported: false,
        createdAt: new Date().toISOString()
      });
      setNewMessage('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `chats/${chatId}/messages`);
    }
  };

  if (!user) return <div className="p-8 text-center">Inicie sessão para conversar.</div>;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 h-[calc(100vh-160px)] flex flex-col">
      <div className="card flex-1 flex flex-col overflow-hidden">
        <div className="p-4 border-b border-black/5 flex items-center space-x-3 bg-white">
          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
            <UserIcon className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-bold">{otherUser?.name || 'Carregando...'}</h3>
            <p className="text-xs text-verified flex items-center"><span className="w-2 h-2 bg-verified rounded-full mr-1"></span> Online</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-bg-main/50">
          {messages.map((msg) => (
            <div key={msg.id} className={cn("flex", msg.senderId === user.id ? "justify-end" : "justify-start")}>
              <div className={cn(
                "max-w-[70%] p-3 rounded-2xl text-sm shadow-sm",
                msg.senderId === user.id ? "bg-primary text-white rounded-tr-none" : "bg-white text-text-main rounded-tl-none"
              )}>
                {msg.content}
                <p className={cn("text-[10px] mt-1 opacity-70", msg.senderId === user.id ? "text-white" : "text-text-sub")}>
                  {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          ))}
          <div ref={scrollRef} />
        </div>

        <form onSubmit={handleSendMessage} className="p-4 bg-white border-t border-black/5 flex items-center space-x-2">
          <input
            type="text"
            placeholder="Escreva uma mensagem..."
            className="flex-1 px-4 py-2 rounded-full bg-bg-main border-none focus:ring-2 focus:ring-primary/20 outline-none"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
          />
          <button type="submit" className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center hover:opacity-90 transition-opacity">
            <Send className="w-5 h-5" />
          </button>
        </form>
      </div>
    </div>
  );
};

const VerificationUpload = ({ user }: { user: User | null }) => {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      const reader = new FileReader();
      reader.onloadend = () => setPreview(reader.result as string);
      reader.readAsDataURL(selected);
    }
  };

  const handleUpload = async () => {
    if (!user || !file) return;
    setUploading(true);
    setTimeout(async () => {
      try {
        await updateDoc(doc(db, 'escort_profiles', user.id), {
          verified: 'pending',
          verificationDate: new Date().toISOString()
        });
        setUploading(false);
        alert('Documento enviado para análise!');
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `escort_profiles/${user.id}`);
      }
    }, 1500);
  };

  return (
    <div className="max-w-md mx-auto p-8 card space-y-6">
      <div className="text-center space-y-2">
        <Shield className="w-12 h-12 text-primary mx-auto" />
        <h2 className="text-2xl font-bold">Verificação de Identidade</h2>
        <p className="text-text-sub text-sm">Envie uma selfie segurando seu documento (BI ou Passaporte) para obter o selo de verificação.</p>
      </div>

      <div className="border-2 border-dashed border-inactive rounded-xl p-8 text-center space-y-4">
        {preview ? (
          <img src={preview} className="max-h-48 mx-auto rounded-lg shadow-md" />
        ) : (
          <div className="space-y-2">
            <Camera className="w-10 h-10 text-inactive mx-auto" />
            <p className="text-sm text-inactive">Clique para tirar foto ou selecionar arquivo</p>
          </div>
        )}
        <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" id="file-upload" />
        <label htmlFor="file-upload" className="btn-secondary inline-block cursor-pointer">Selecionar Foto</label>
      </div>

      <button
        onClick={handleUpload}
        disabled={!file || uploading}
        className="w-full btn-primary py-3 flex items-center justify-center space-x-2"
      >
        {uploading ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div> : <span>Enviar para Análise</span>}
      </button>
    </div>
  );
};

const AdminPanel = () => {
  const [pendingEscorts, setPendingEscorts] = useState<EscortProfile[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'escort_profiles'), where('verified', '==', 'pending'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setPendingEscorts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as EscortProfile)));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'escort_profiles');
    });
    return () => unsubscribe();
  }, []);

  const handleApprove = async (id: string) => {
    try {
      await updateDoc(doc(db, 'escort_profiles', id), { verified: 'verified', verificationDate: new Date().toISOString() });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `escort_profiles/${id}`);
    }
  };

  const handleReject = async (id: string) => {
    try {
      await updateDoc(doc(db, 'escort_profiles', id), { verified: 'unverified' });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `escort_profiles/${id}`);
    }
  };

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <h1 className="text-3xl font-bold">Painel de Administração</h1>
      
      <section className="space-y-4">
        <h2 className="text-xl font-bold flex items-center space-x-2">
          <Shield className="w-5 h-5 text-primary" />
          <span>Verificações Pendentes ({pendingEscorts.length})</span>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {pendingEscorts.map(escort => (
            <div key={escort.id} className="card p-4 flex flex-col justify-between">
              <div>
                <h3 className="font-bold">{escort.artisticName}</h3>
                <p className="text-sm text-text-sub">{escort.city} • {escort.age} anos</p>
                <div className="mt-2 aspect-video bg-gray-100 rounded-lg overflow-hidden">
                   <img src={`https://picsum.photos/seed/${escort.id}/400/225`} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <button onClick={() => handleApprove(escort.id)} className="flex-1 bg-verified text-white py-2 rounded-lg text-sm font-bold">Aprovar</button>
                <button onClick={() => handleReject(escort.id)} className="flex-1 bg-alert text-white py-2 rounded-lg text-sm font-bold">Rejeitar</button>
              </div>
            </div>
          ))}
          {pendingEscorts.length === 0 && <p className="text-text-sub italic">Nenhuma verificação pendente.</p>}
        </div>
      </section>
    </div>
  );
};

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [showRoleSelection, setShowRoleSelection] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
        if (userDoc.exists()) {
          setUser({ id: userDoc.id, ...userDoc.data() } as User);
          setShowRoleSelection(false);
        } else {
          const isAdminEmail = firebaseUser.email === "adilsonnguali@gmail.com";
          if (isAdminEmail) {
            const adminUser: User = {
              id: firebaseUser.uid,
              name: firebaseUser.displayName || 'Admin',
              email: firebaseUser.email || '',
              type: 'admin',
              status: 'active',
              createdAt: new Date().toISOString(),
              lastAccess: new Date().toISOString()
            };
            await setDoc(doc(db, 'users', firebaseUser.uid), adminUser);
            setUser(adminUser);
            setShowRoleSelection(false);
          } else {
            setShowRoleSelection(true);
          }
        }
      } else {
        setUser(null);
        setShowRoleSelection(false);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const seedData = async () => {
      if (user?.type !== 'admin') return;
      try {
        const snapshot = await getDoc(doc(db, 'escort_profiles', 'seed_check'));
        if (!snapshot.exists()) {
          // Only seed if we are authenticated as admin or it's the first run
          const mockEscorts = [
            { id: 'escort_1', artisticName: 'João M.', age: 28, city: 'Luanda', bodyType: 'atlético', verified: 'verified', rating: 4.8, views: 120, bio: 'Acompanhante discreto e educado para jantares e eventos.' },
            { id: 'escort_2', artisticName: 'Carlos P.', age: 32, city: 'Benguela', bodyType: 'forte', verified: 'verified', rating: 4.5, views: 85, bio: 'Disponível para festas e viagens. Experiência em eventos corporativos.' },
            { id: 'escort_3', artisticName: 'Miguel S.', age: 25, city: 'Lubango', bodyType: 'magro', verified: 'verified', rating: 4.9, views: 210, bio: 'Companhia agradável para passeios e conversas interessantes.' },
            { id: 'escort_4', artisticName: 'Ricardo F.', age: 30, city: 'Huambo', bodyType: 'musculoso', verified: 'pending', rating: 4.7, views: 45, bio: 'Focado em bem-estar e companhia de elite.' }
          ];

          for (const e of mockEscorts) {
            try {
              await setDoc(doc(db, 'escort_profiles', e.id), { ...e, userId: e.id, verificationDate: new Date().toISOString() });
            } catch (err) {
              console.warn(`Failed to seed escort ${e.id}:`, err);
            }
          }
          await setDoc(doc(db, 'escort_profiles', 'seed_check'), { seeded: true });
        }
      } catch (err) {
        console.warn('Seed check failed (likely permissions):', err);
      }
    };
    seedData();
  }, [user]);

  const handleRoleSelect = async (type: UserType) => {
    if (!auth.currentUser) return;
    const newUser: User = {
      id: auth.currentUser.uid,
      name: auth.currentUser.displayName || 'Utilizador',
      email: auth.currentUser.email || '',
      type,
      status: 'active',
      createdAt: new Date().toISOString(),
      lastAccess: new Date().toISOString()
    };
    await setDoc(doc(db, 'users', auth.currentUser.uid), newUser);
    setUser(newUser);
    setShowRoleSelection(false);

    if (type === 'escort') {
      // Create initial empty profile
      await setDoc(doc(db, 'escort_profiles', auth.currentUser.uid), {
        userId: auth.currentUser.uid,
        artisticName: auth.currentUser.displayName || 'Novo Acompanhante',
        age: 18,
        city: 'Luanda',
        verified: 'pending',
        views: 0,
        rating: 5.0
      });
    }
  };

  const handleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error('Login error:', error);
    }
  };

  const handleLogout = () => signOut(auth);

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-main flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (showRoleSelection) {
    return (
      <div className="min-h-screen bg-bg-main">
        <Navbar user={null} onLogin={handleLogin} onLogout={handleLogout} />
        <RoleSelection onSelect={handleRoleSelect} />
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <Router>
        <div className="min-h-screen bg-bg-main">
          <Navbar user={user} onLogin={handleLogin} onLogout={handleLogout} />
          <main className="pb-20">
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/escort/:id" element={<EscortProfilePage user={user} />} />
              <Route path="/chat/:id" element={<ChatPage user={user} />} />
              <Route path="/verification" element={<VerificationUpload user={user} />} />
              <Route path="/favorites" element={<div className="p-8">Favoritos (Em breve)</div>} />
              <Route path="/messages" element={<div className="p-8">Mensagens (Em breve)</div>} />
              <Route path="/profile" element={<div className="p-8">Meu Perfil (Em breve)</div>} />
              <Route path="/admin" element={<AdminPanel />} />
            </Routes>
          </main>
          
          <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-black/5 p-2 flex justify-center z-40">
            <div className="w-full max-w-[320px] h-[50px] bg-gray-100 border border-dashed border-inactive flex items-center justify-center text-[10px] text-inactive uppercase tracking-widest">
              Espaço Publicitário AdMob
            </div>
          </div>
        </div>
      </Router>
    </ErrorBoundary>
  );
}
