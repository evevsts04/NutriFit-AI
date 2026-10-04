import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  signInWithCustomToken, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  onAuthStateChanged, 
  signOut 
} from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDoc, 
  onSnapshot, 
  updateDoc 
} from 'firebase/firestore';
import { 
  Activity, Droplets, Flame, User, LogOut, Plus, Settings, 
  X, Check, ChevronRight, Utensils, Apple, Coffee, Moon, Sun, 
  BrainCircuit, AlertCircle, Info, TrendingUp, TrendingDown, Minus
} from 'lucide-react';

// Firebase Config provided by environment
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = 'nutrifit-app'; // Nome fixo para o banco de dados

const getLocalDateString = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const calculateBMR = (weight, height, age, gender) => {
  // Equação Mifflin-St Jeor
  let bmr = (10 * weight) + (6.25 * height) - (5 * age);
  return gender === 'male' ? bmr + 5 : bmr - 161;
};

const calculateTargets = (weight, height, age, gender, activity, goal) => {
  const bmr = calculateBMR(weight, height, age, gender);
  const tdee = bmr * activity;
  
  let targetCalories = tdee;
  if (goal === 'loss') targetCalories -= 500;
  if (goal === 'gain') targetCalories += 300;
  
  targetCalories = Math.round(targetCalories);

  // Divisão de Macros Básica
  const protein = Math.round(weight * 2.2); // 2.2g por kg
  const fats = Math.round(weight * 1.0); // 1g por kg
  const carbCalories = targetCalories - (protein * 4) - (fats * 9);
  const carbs = Math.max(50, Math.round(carbCalories / 4)); // Mínimo de 50g

  return { calories: targetCalories, protein, carbs, fats, water: 2500 + (activity > 1.3 ? 500 : 0) };
};

export default function App() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [todayLog, setTodayLog] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentScreen, setCurrentScreen] = useState('auth'); // auth, setup, dashboard
  const [dateString, setDateString] = useState(getLocalDateString());
  
  // UI States
  const [toast, setToast] = useState({ show: false, message: '', type: 'info' });
  const [showMealModal, setShowMealModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [selectedMealSection, setSelectedMealSection] = useState('Almoço');
  const [apiKey, setApiKey] = useState(localStorage.getItem('gemini_api_key') || '');

  const showToast = (message, type = 'info') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'info' }), 3500);
  };

  // Auth Initialization
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        }
      } catch (err) {
        console.error("Auth init error:", err);
      }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        await loadProfile(currentUser.uid);
      } else {
        setCurrentScreen('auth');
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  // Daily Log Subscription
  useEffect(() => {
    if (!user || currentScreen !== 'dashboard') return;
    
    const logRef = doc(db, 'artifacts', appId, 'users', user.uid, 'logs', dateString);
    const unsubscribe = onSnapshot(logRef, (docSnap) => {
      if (docSnap.exists()) {
        setTodayLog(docSnap.data());
      } else {
        // Inicializa o dia vazio
        const initialLog = {
          water: 0,
          meals: [],
          totals: { calories: 0, protein: 0, carbs: 0, fats: 0 }
        };
        setDoc(logRef, initialLog).catch(err => console.error("Erro ao criar log diário", err));
        setTodayLog(initialLog);
      }
      setLoading(false);
    }, (error) => {
      console.error("Erro no onSnapshot do log:", error);
      showToast("Erro ao carregar dados do dia.", "error");
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, currentScreen, dateString]);

  const loadProfile = async (uid) => {
    setLoading(true);
    try {
      const docRef = doc(db, 'artifacts', appId, 'users', uid);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        setProfile(snap.data());
        setCurrentScreen('dashboard');
      } else {
        setCurrentScreen('setup');
        setLoading(false);
      }
    } catch (e) {
      console.error(e);
      showToast("Erro ao carregar perfil.", "error");
      setLoading(false);
    }
  };

  const handleSaveProfile = async (profileData) => {
    if (!user) return;
    setLoading(true);
    try {
      await setDoc(doc(db, 'artifacts', appId, 'users', user.uid), profileData);
      setProfile(profileData);
      setCurrentScreen('dashboard');
      showToast("Perfil configurado com sucesso!", "success");
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const addWater = async (amount) => {
    if (!user || !todayLog) return;
    const logRef = doc(db, 'artifacts', appId, 'users', user.uid, 'logs', dateString);
    try {
      await updateDoc(logRef, { water: todayLog.water + amount });
    } catch (e) {
      console.error(e);
      showToast("Erro ao adicionar água.", "error");
    }
  };

  const saveMeal = async (mealData) => {
    if (!user || !todayLog) return;
    const logRef = doc(db, 'artifacts', appId, 'users', user.uid, 'logs', dateString);
    
    const newMeals = [...todayLog.meals, mealData];
    const newTotals = {
      calories: todayLog.totals.calories + mealData.calories,
      protein: todayLog.totals.protein + mealData.protein,
      carbs: todayLog.totals.carbs + mealData.carbs,
      fats: todayLog.totals.fats + mealData.fats
    };

    try {
      await updateDoc(logRef, { meals: newMeals, totals: newTotals });
      setShowMealModal(false);
      showToast("Refeição adicionada!", "success");
    } catch (e) {
      showToast("Erro ao salvar refeição", "error");
    }
  };

  const Toast = () => {
    if (!toast.show) return null;
    const colors = {
      success: 'bg-green-900 border-green-500 text-green-100',
      error: 'bg-red-900 border-red-500 text-red-100',
      info: 'bg-slate-800 border-slate-600 text-slate-100'
    };
    const Icon = toast.type === 'success' ? Check : toast.type === 'error' ? AlertCircle : Info;
    
    return (
      <div className={`fixed top-4 left-1/2 transform -translate-x-1/2 z-50 flex items-center p-3 rounded-lg border shadow-lg ${colors[toast.type]} transition-all duration-300 min-w-[300px]`}>
        <Icon className="w-5 h-5 mr-3" />
        <span className="text-sm font-medium">{toast.message}</span>
      </div>
    );
  };

  const MealModal = () => {
    const [input, setInput] = useState('');
    const [aiResult, setAiResult] = useState(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    const analyzeMeal = async () => {
      if (!input.trim()) return showToast("Descreva o que você comeu.", "error");
      setIsAnalyzing(true);
      setAiResult(null);

      const prompt = `Você é um nutricionista. Analise esta refeição: "${input}".
      Estime os macronutrientes totais. 
      Retorne APENAS um objeto JSON válido (sem blocos markdown como \`\`\`json) contendo exatamente estas chaves:
      "name" (nome resumido da refeição), "calories" (número), "protein" (número em gramas), "carbs" (número em gramas), "fats" (número em gramas).`;

      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`;
        const payload = {
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json" }
        };

        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (!response.ok) throw new Error("Falha na API");
        const data = await response.json();
        
        let text = data.candidates[0].content.parts[0].text;
        text = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const result = JSON.parse(text);

        setAiResult({
          name: result.name || 'Refeição Customizada',
          calories: Math.round(Number(result.calories) || 0),
          protein: Math.round(Number(result.protein) || 0),
          carbs: Math.round(Number(result.carbs) || 0),
          fats: Math.round(Number(result.fats) || 0),
          section: selectedMealSection,
          timestamp: Date.now()
        });
      } catch (err) {
        console.error("AI Error:", err);
        showToast("Falha ao analisar com IA. Tente novamente.", "error");
      } finally {
        setIsAnalyzing(false);
      }
    };

    if (!showMealModal) return null;

    return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40 flex items-end sm:items-center justify-center p-4">
        <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-3xl p-6 shadow-2xl relative">
          <button onClick={() => setShowMealModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white">
            <X className="w-6 h-6" />
          </button>
          
          <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
            <Utensils className="text-emerald-400 w-5 h-5" /> Adicionar a {selectedMealSection}
          </h3>
          <p className="text-sm text-slate-400 mb-4">Descreva sua refeição e a IA do Gemini calculará os macros para você.</p>
          
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={3}
            placeholder="Ex: 2 ovos mexidos, 1 fatia de pão integral e um café preto sem açúcar..."
            className="w-full bg-slate-800 border border-slate-700 rounded-xl p-4 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors mb-4 resize-none"
          />

          {!aiResult ? (
            <button
              onClick={analyzeMeal}
              disabled={isAnalyzing}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isAnalyzing ? (
                <><BrainCircuit className="w-5 h-5 animate-pulse" /> Analisando com IA...</>
              ) : (
                <><BrainCircuit className="w-5 h-5" /> Calcular Macros (IA)</>
              )}
            </button>
          ) : (
            <div className="space-y-4">
              <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
                <h4 className="text-white font-semibold mb-3 pb-2 border-b border-slate-700">{aiResult.name}</h4>
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div>
                    <span className="block text-white font-bold text-lg">{aiResult.calories}</span>
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider">Kcal</span>
                  </div>
                  <div>
                    <span className="block text-blue-400 font-bold text-lg">{aiResult.protein}g</span>
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider">Prot</span>
                  </div>
                  <div>
                    <span className="block text-amber-400 font-bold text-lg">{aiResult.carbs}g</span>
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider">Carb</span>
                  </div>
                  <div>
                    <span className="block text-rose-400 font-bold text-lg">{aiResult.fats}g</span>
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider">Gord</span>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setAiResult(null)} className="flex-1 bg-slate-800 hover:bg-slate-700 text-white py-3 rounded-xl transition">Refazer</button>
                <button onClick={() => saveMeal(aiResult)} className="flex-[2] bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-3 rounded-xl transition">Confirmar e Salvar</button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const SettingsModal = () => {
    const [tempKey, setTempKey] = useState(apiKey);
    
    if (!showSettingsModal) return null;

    const saveSettings = () => {
      setApiKey(tempKey);
      localStorage.setItem('gemini_api_key', tempKey);
      setShowSettingsModal(false);
      showToast("Configurações salvas!", "success");
    };

    return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-slate-900 border border-slate-700 w-full max-w-sm rounded-3xl p-6 shadow-2xl relative">
          <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <Settings className="text-slate-400 w-5 h-5" /> Configurações
          </h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1 ml-1">Chave da API Gemini (Opcional)</label>
              <input
                type="password"
                value={tempKey}
                onChange={(e) => setTempKey(e.target.value)}
                placeholder="Insira sua API Key..."
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
              <p className="text-[10px] text-slate-500 mt-2">
                Se deixado em branco, o sistema tentará usar a chave padrão do ambiente (Canvas).
              </p>
            </div>
            
            <div className="flex gap-2 pt-4">
              <button onClick={() => setShowSettingsModal(false)} className="flex-1 bg-slate-800 hover:bg-slate-700 text-white py-3 rounded-xl transition">Cancelar</button>
              <button onClick={saveSettings} className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-xl transition">Salvar</button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const AuthScreen = () => {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    const handleEmailAuth = async (e) => {
      e.preventDefault();
      if (!email || !password) return showToast("Preencha todos os campos.", "error");
      setLoading(true);
      try {
        if (isLogin) {
          await signInWithEmailAndPassword(auth, email, password);
        } else {
          await createUserWithEmailAndPassword(auth, email, password);
        }
      } catch (err) {
        showToast(err.message, "error");
        setLoading(false);
      }
    };

    const handleGuest = async () => {
      setLoading(true);
      try { await signInAnonymously(auth); } 
      catch (err) { showToast(err.message, "error"); setLoading(false); }
    };

    return (
      <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-6 relative overflow-hidden">
        {/* BG Decorations */}
        <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-emerald-500/20 to-transparent blur-3xl pointer-events-none"></div>
        
        <div className="w-full max-w-md z-10">
          <div className="text-center mb-10">
            <div className="w-20 h-20 bg-slate-900 border border-emerald-500/30 rounded-2xl mx-auto flex items-center justify-center text-emerald-400 mb-6 shadow-[0_0_40px_rgba(16,185,129,0.2)]">
              <Activity className="w-10 h-10" />
            </div>
            <h1 className="text-3xl font-extrabold text-white mb-2">NutriFit <span className="text-emerald-400">AI</span></h1>
            <p className="text-slate-400">Seu parceiro inteligente de nutrição.</p>
          </div>

          <form onSubmit={handleEmailAuth} className="space-y-4">
            <div>
              <input type="email" placeholder="Seu E-mail" value={email} onChange={e=>setEmail(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-4 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors" />
            </div>
            <div>
              <input type="password" placeholder="Sua Senha" value={password} onChange={e=>setPassword(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-4 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors" />
            </div>
            <button type="submit" className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-lg py-4 rounded-xl transition-all shadow-[0_4px_20px_rgba(16,185,129,0.3)]">
              {isLogin ? 'Entrar' : 'Criar Conta'}
            </button>
          </form>

          <div className="mt-6 flex flex-col gap-4">
            <button type="button" onClick={() => setIsLogin(!isLogin)} className="text-slate-400 text-sm hover:text-white transition">
              {isLogin ? 'Não tem uma conta? Cadastre-se' : 'Já tem conta? Faça login'}
            </button>
            
            <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-slate-800"></div>
                <span className="flex-shrink-0 mx-4 text-slate-600 text-xs uppercase font-semibold">OU</span>
                <div className="flex-grow border-t border-slate-800"></div>
            </div>

            <button onClick={handleGuest} className="w-full bg-slate-800 hover:bg-slate-700 text-white font-medium py-3.5 rounded-xl transition-all border border-slate-700 flex justify-center items-center gap-2">
              <User className="w-4 h-4" /> Entrar como Convidado
            </button>
          </div>
        </div>
      </div>
    );
  };

  const OnboardingScreen = () => {
    const [formData, setFormData] = useState({
      weight: 70, height: 170, age: 30, gender: 'male', activity: 1.2, goal: 'loss'
    });

    const handleSubmit = (e) => {
      e.preventDefault();
      const targets = calculateTargets(
        Number(formData.weight), Number(formData.height), Number(formData.age),
        formData.gender, Number(formData.activity), formData.goal
      );
      
      const completeProfile = { ...formData, targets, createdAt: new Date().toISOString() };
      handleSaveProfile(completeProfile);
    };

    return (
      <div className="min-h-screen bg-slate-950 text-white p-6 pb-24 overflow-y-auto">
        <div className="max-w-md mx-auto">
          <h2 className="text-2xl font-bold mb-2 pt-6">Configure seu Perfil</h2>
          <p className="text-slate-400 text-sm mb-8">Vamos calcular suas necessidades metabólicas ideais para o seu objetivo.</p>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs text-slate-400 ml-1">Peso Atual (kg)</label>
                <input type="number" step="0.1" required value={formData.weight} onChange={e=>setFormData({...formData, weight: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 focus:border-emerald-500 outline-none" />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-400 ml-1">Altura (cm)</label>
                <input type="number" required value={formData.height} onChange={e=>setFormData({...formData, height: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 focus:border-emerald-500 outline-none" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs text-slate-400 ml-1">Idade</label>
                <input type="number" required value={formData.age} onChange={e=>setFormData({...formData, age: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 focus:border-emerald-500 outline-none" />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-400 ml-1">Gênero</label>
                <select value={formData.gender} onChange={e=>setFormData({...formData, gender: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 focus:border-emerald-500 outline-none">
                  <option value="male">Masculino</option>
                  <option value="female">Feminino</option>
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-slate-400 ml-1">Nível de Atividade Física</label>
              <select value={formData.activity} onChange={e=>setFormData({...formData, activity: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 focus:border-emerald-500 outline-none">
                <option value="1.2">Sedentário (Trabalho de escritório)</option>
                <option value="1.375">Leve (1-2 dias/semana)</option>
                <option value="1.55">Moderado (3-5 dias/semana)</option>
                <option value="1.725">Intenso (6-7 dias/semana)</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs text-slate-400 ml-1">Objetivo Principal</label>
              <div className="grid grid-cols-3 gap-3">
                <label className="cursor-pointer">
                  <input type="radio" name="goal" value="loss" checked={formData.goal === 'loss'} onChange={e=>setFormData({...formData, goal: e.target.value})} className="peer sr-only" />
                  <div className="p-4 rounded-xl border border-slate-700 bg-slate-900 peer-checked:border-emerald-500 peer-checked:bg-emerald-500/10 text-center transition-all">
                    <TrendingDown className={`w-6 h-6 mx-auto mb-2 ${formData.goal === 'loss' ? 'text-emerald-400' : 'text-slate-500'}`} />
                    <span className="text-xs font-medium">Perder</span>
                  </div>
                </label>
                <label className="cursor-pointer">
                  <input type="radio" name="goal" value="maintain" checked={formData.goal === 'maintain'} onChange={e=>setFormData({...formData, goal: e.target.value})} className="peer sr-only" />
                  <div className="p-4 rounded-xl border border-slate-700 bg-slate-900 peer-checked:border-emerald-500 peer-checked:bg-emerald-500/10 text-center transition-all">
                    <Minus className={`w-6 h-6 mx-auto mb-2 ${formData.goal === 'maintain' ? 'text-emerald-400' : 'text-slate-500'}`} />
                    <span className="text-xs font-medium">Manter</span>
                  </div>
                </label>
                <label className="cursor-pointer">
                  <input type="radio" name="goal" value="gain" checked={formData.goal === 'gain'} onChange={e=>setFormData({...formData, goal: e.target.value})} className="peer sr-only" />
                  <div className="p-4 rounded-xl border border-slate-700 bg-slate-900 peer-checked:border-emerald-500 peer-checked:bg-emerald-500/10 text-center transition-all">
                    <TrendingUp className={`w-6 h-6 mx-auto mb-2 ${formData.goal === 'gain' ? 'text-emerald-400' : 'text-slate-500'}`} />
                    <span className="text-xs font-medium">Ganhar</span>
                  </div>
                </label>
              </div>
            </div>

            <button type="submit" className="w-full mt-8 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-4 rounded-xl transition-all shadow-[0_4px_20px_rgba(16,185,129,0.3)]">
              Gerar Plano Nutricional
            </button>
          </form>
        </div>
      </div>
    );
  };

  const DashboardScreen = () => {
    if (!profile || !todayLog) return null;

    const t = profile.targets;
    const c = todayLog.totals;
    const remainingCals = Math.max(0, t.calories - c.calories);
    const calPercent = Math.min(100, (c.calories / t.calories) * 100);
    const strokeDashoffset = 283 - (283 * calPercent) / 100;

    const mealSections = [
      { name: 'Café da Manhã', icon: Coffee, color: 'text-amber-400' },
      { name: 'Lanche da Manhã', icon: Apple, color: 'text-red-400' },
      { name: 'Almoço', icon: Utensils, color: 'text-orange-500' },
      { name: 'Lanche da Tarde', icon: Sun, color: 'text-yellow-500' },
      { name: 'Jantar', icon: Moon, color: 'text-indigo-400' },
      { name: 'Outros', icon: Plus, color: 'text-slate-400' },
    ];

    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col relative pb-24">
        {/* Header */}
        <header className="sticky top-0 z-10 bg-slate-950/80 backdrop-blur-lg border-b border-slate-800 p-5 flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Activity className="text-emerald-400 w-6 h-6" /> Hoje
            </h1>
            <p className="text-xs text-slate-400 mt-1 capitalize">
              {new Date(dateString + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
            </p>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setShowSettingsModal(true)} className="w-10 h-10 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 hover:text-white transition">
              <Settings className="w-5 h-5" />
            </button>
            <button onClick={() => signOut(auth)} className="w-10 h-10 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-rose-400 hover:bg-rose-500/10 transition">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        <div className="p-4 space-y-6 max-w-md mx-auto w-full flex-1">
          {/* Calorie Ring */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 relative overflow-hidden">
            <div className="absolute -right-10 -top-10 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>
            
            <div className="flex justify-center mb-4">
              <div className="relative w-48 h-48 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="45" fill="none" stroke="#1e293b" strokeWidth="8"></circle>
                  <circle 
                    cx="50" cy="50" r="45" fill="none" 
                    stroke={c.calories > t.calories ? '#f43f5e' : '#10b981'} 
                    strokeWidth="8" strokeDasharray="283" 
                    strokeDashoffset={strokeDashoffset} 
                    strokeLinecap="round"
                    className="transition-all duration-1000 ease-out"
                  ></circle>
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="text-4xl font-extrabold tracking-tighter">{remainingCals}</span>
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mt-1">Restantes</span>
                </div>
              </div>
            </div>
            
            <div className="flex justify-between px-4 text-sm font-medium">
              <div className="text-center">
                <span className="text-slate-500 text-xs block mb-1">Consumido</span>
                <span className="text-white text-lg font-bold">{c.calories}</span>
              </div>
              <div className="text-center">
                <span className="text-slate-500 text-xs block mb-1">Meta</span>
                <span className="text-white text-lg font-bold">{t.calories}</span>
              </div>
            </div>
          </div>

          {/* Macros */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { id: 'pro', label: 'Proteína', current: c.protein, target: t.protein, color: 'bg-blue-500', bg: 'bg-blue-500/20' },
              { id: 'carb', label: 'Carboidrato', current: c.carbs, target: t.carbs, color: 'bg-amber-500', bg: 'bg-amber-500/20' },
              { id: 'fat', label: 'Gordura', current: c.fats, target: t.fats, color: 'bg-rose-500', bg: 'bg-rose-500/20' }
            ].map(macro => (
              <div key={macro.id} className="bg-slate-900 border border-slate-800 p-3 rounded-2xl">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[11px] font-semibold text-slate-300">{macro.label}</span>
                </div>
                <div className="text-sm font-bold text-white mb-2">{macro.current} <span className="text-[10px] font-normal text-slate-500">/ {macro.target}g</span></div>
                <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                  <div 
                    className={`${macro.color} h-full rounded-full transition-all duration-1000`} 
                    style={{ width: `${Math.min(100, (macro.current / macro.target) * 100)}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>

          {/* Water Tracker */}
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-3xl flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center border border-cyan-500/20">
                <Droplets className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">Água Consumida</h3>
                <p className="text-xs text-slate-400 mt-0.5"><strong className="text-white">{todayLog.water}</strong> / {t.water} ml</p>
              </div>
            </div>
            <button onClick={() => addWater(250)} className="w-10 h-10 rounded-full bg-slate-800 hover:bg-cyan-500/20 hover:text-cyan-400 border border-slate-700 transition flex items-center justify-center">
              <Plus className="w-5 h-5" />
            </button>
          </div>

          {/* Meals List */}
          <div className="space-y-4">
            <h3 className="font-bold text-lg px-1 pt-2">Refeições</h3>
            {mealSections.map((section, idx) => {
              const mealsInSection = todayLog.meals.filter(m => m.section === section.name);
              const sectionCals = mealsInSection.reduce((acc, curr) => acc + curr.calories, 0);

              return (
                <div key={idx} className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                  <div 
                    className="p-4 flex justify-between items-center bg-slate-800/30 cursor-pointer hover:bg-slate-800/50 transition"
                    onClick={(e) => {
                      const content = e.currentTarget.nextElementSibling;
                      content.classList.toggle('hidden');
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <section.icon className={`w-5 h-5 ${section.color}`} />
                      <span className="font-semibold text-sm">{section.name}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-xs font-bold text-slate-300">{sectionCals} kcal</span>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedMealSection(section.name);
                          setShowMealModal(true);
                        }} 
                        className="text-emerald-400 hover:text-emerald-300 w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center transition"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  
                  {/* Meal Items (Hidden by default if empty, open if has items) */}
                  <div className={`${mealsInSection.length === 0 ? 'hidden' : ''} border-t border-slate-800 p-2 space-y-2 bg-slate-900/50`}>
                    {mealsInSection.length === 0 ? (
                      <div className="p-3 text-center text-xs text-slate-500 italic">Nenhuma refeição registrada.</div>
                    ) : (
                      mealsInSection.map((m, i) => (
                        <div key={i} className="p-3 bg-slate-950 rounded-xl flex justify-between items-center border border-slate-800/50">
                          <div>
                            <p className="text-sm font-medium text-slate-200">{m.name}</p>
                            <p className="text-[10px] text-slate-400 mt-1">P: {m.protein}g • C: {m.carbs}g • G: {m.fats}g</p>
                          </div>
                          <div className="text-right">
                            <span className="text-sm font-bold block">{m.calories}</span>
                            <span className="text-[9px] text-slate-500 uppercase">kcal</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Global Floating Action Button */}
        <button 
          onClick={() => { setSelectedMealSection('Outros'); setShowMealModal(true); }} 
          className="fixed bottom-6 right-6 w-14 h-14 bg-emerald-500 text-slate-950 rounded-full shadow-[0_4px_20px_rgba(16,185,129,0.5)] flex items-center justify-center hover:scale-105 transition-transform z-20"
        >
          <Plus className="w-6 h-6" />
        </button>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center">
        <Activity className="w-12 h-12 text-emerald-500 animate-pulse mb-4" />
        <p className="text-slate-400 font-medium tracking-wide">Carregando NutriFit...</p>
      </div>
    );
  }

  return (
    <div className="font-sans antialiased text-slate-100 bg-slate-950 min-h-screen">
      <Toast />
      <MealModal />
      <SettingsModal />

      {currentScreen === 'auth' && <AuthScreen />}
      {currentScreen === 'setup' && <OnboardingScreen />}
      {currentScreen === 'dashboard' && <DashboardScreen />}
    </div>
  );
}