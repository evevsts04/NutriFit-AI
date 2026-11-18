import React, { useState, useEffect, useMemo } from 'react';
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
  updateDoc,
  deleteDoc,
  collection,
  addDoc
} from 'firebase/firestore';
import {
  Activity, Droplets, User, LogOut, Plus, Settings,
  X, Check, ChevronLeft, ChevronRight, Utensils, Apple, Coffee, Moon, Sun,
  BrainCircuit, AlertCircle, Info, TrendingUp, TrendingDown, Minus,
  Scale, Target, Trash2, Search, Calendar, BarChart3, Bookmark,
  Sparkles, Edit3, Award, SlidersHorizontal, Dumbbell, Flame
} from 'lucide-react';

// ==========================================
// CONFIGURAÇÃO DO FIREBASE
// ==========================================
const firebaseConfig = {
  apiKey: "AIzaSyBvxGPt966FFn9283gc2SRLYZrRbfHQ_4Y",
  authDomain: "nutrifit-ai-afdd5.firebaseapp.com",
  projectId: "nutrifit-ai-afdd5",
  storageBucket: "nutrifit-ai-afdd5.firebasestorage.app",
  messagingSenderId: "912273156639",
  appId: "1:912273156639:web:57dc596ef5655725a0832a"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = 'nutrifit-app';

// ==========================================
// FUNÇÕES UTILITÁRIAS DE DATA E METABOLISMO
// ==========================================
const getLocalDateString = (dateObj = new Date()) => {
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const shiftDateString = (dateStr, deltaDays) => {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + deltaDays);
  return getLocalDateString(dt);
};

const formatShortDate = (dateStr) => {
  if (!dateStr) return '';
  const [, m, d] = dateStr.split('-');
  return `${d}/${m}`;
};

const formatFullDatePT = (dateStr) => {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d, 12, 0, 0);
  return dt.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long'
  });
};

const getPastDateRange = (daysCount) => {
  const todayStr = getLocalDateString();
  const list = [];
  for (let i = daysCount - 1; i >= 0; i--) {
    list.push(shiftDateString(todayStr, -i));
  }
  return list;
};

// Opções de rotina diária (NEAT) e intensidade de treino
const NEAT_OPTIONS = [
  { value: 1.2, label: 'Sedentário / Escritório', desc: 'Maior parte do dia sentado' },
  { value: 1.3, label: 'Levemente ativo', desc: 'Em pé ou caminhando parte do dia' },
  { value: 1.4, label: 'Moderadamente ativo', desc: 'Movimentação constante na rotina' },
  { value: 1.55, label: 'Trabalho físico intenso', desc: 'Esforço físico pesado diário' }
];

const TRAINING_INTENSITY_OPTIONS = [
  { id: 'light', label: 'Leve', kcal: 200, desc: '~200 kcal/sessão' },
  { id: 'moderate', label: 'Moderado', kcal: 350, desc: '~350 kcal/sessão' },
  { id: 'intense', label: 'Intenso', kcal: 500, desc: '~500 kcal/sessão' }
];

const PACE_PRESETS = {
  gain: [
    { id: 'conservative', label: 'Limpo', delta: 250, desc: '+250 kcal' },
    { id: 'moderate', label: 'Moderado', delta: 350, desc: '+350 kcal' },
    { id: 'aggressive', label: 'Agressivo', delta: 500, desc: '+500 kcal' },
    { id: 'custom', label: 'Personalizado', delta: null, desc: 'Livre' }
  ],
  loss: [
    { id: 'conservative', label: 'Leve', delta: -300, desc: '-300 kcal' },
    { id: 'moderate', label: 'Moderado', delta: -500, desc: '-500 kcal' },
    { id: 'aggressive', label: 'Agressivo', delta: -700, desc: '-700 kcal' },
    { id: 'custom', label: 'Personalizado', delta: null, desc: 'Livre' }
  ]
};

// Normaliza perfis antigos ou parciais para o novo formato do formulário
const normalizeProfileFormData = (existingProfile = null) => {
  const mapOldActivityToNeat = (act) => {
    const num = Number(act);
    if (!num) return 1.2;
    if (num <= 1.25) return 1.2;
    if (num <= 1.38) return 1.3;
    if (num <= 1.56) return 1.4;
    return 1.55;
  };

  if (!existingProfile) {
    return {
      weight: 65,
      targetWeight: 75,
      height: 175,
      age: 28,
      gender: 'male',
      bodyFat: '',
      neatFactor: 1.2,
      trainingDays: 4,
      trainingIntensity: 'moderate',
      extraDailyBurn: 0,
      goal: 'gain',
      pacePreset: 'moderate',
      customCalorieDelta: 350,
      manualCaloriesOverride: '',
      proteinPerKg: 2.0,
      fatPerKg: 0.9,
      waterMlPerKg: 38
    };
  }

  const goal = existingProfile.goal || 'gain';
  const defaultCustomDelta = goal === 'loss' ? 400 : 350;

  return {
    weight: existingProfile.weight ?? 65,
    targetWeight: existingProfile.targetWeight ?? 75,
    height: existingProfile.height ?? 175,
    age: existingProfile.age ?? 28,
    gender: existingProfile.gender || 'male',
    bodyFat:
      existingProfile.bodyFat !== undefined && existingProfile.bodyFat !== null
        ? existingProfile.bodyFat
        : '',
    neatFactor:
      existingProfile.neatFactor !== undefined
        ? Number(existingProfile.neatFactor)
        : mapOldActivityToNeat(existingProfile.activity),
    trainingDays:
      existingProfile.trainingDays !== undefined ? Number(existingProfile.trainingDays) : 4,
    trainingIntensity: existingProfile.trainingIntensity || 'moderate',
    extraDailyBurn:
      existingProfile.extraDailyBurn !== undefined ? Number(existingProfile.extraDailyBurn) : 0,
    goal,
    pacePreset: existingProfile.pacePreset || 'moderate',
    customCalorieDelta:
      existingProfile.customCalorieDelta !== undefined
        ? Number(existingProfile.customCalorieDelta)
        : defaultCustomDelta,
    manualCaloriesOverride:
      existingProfile.manualCaloriesOverride !== undefined &&
      existingProfile.manualCaloriesOverride !== null
        ? existingProfile.manualCaloriesOverride
        : '',
    proteinPerKg:
      existingProfile.proteinPerKg !== undefined ? Number(existingProfile.proteinPerKg) : 2.0,
    fatPerKg: existingProfile.fatPerKg !== undefined ? Number(existingProfile.fatPerKg) : 0.9,
    waterMlPerKg:
      existingProfile.waterMlPerKg !== undefined ? Number(existingProfile.waterMlPerKg) : 38
  };
};

// Novo Motor de Cálculo Nutricional Personalizado
const calculateTargets = (input) => {
  const weight = Math.max(30, Number(input.weight) || 65);
  const height = Math.max(100, Number(input.height) || 175);
  const age = Math.max(12, Number(input.age) || 28);
  const gender = input.gender === 'female' ? 'female' : 'male';

  const parsedBf = input.bodyFat !== '' && input.bodyFat !== null && input.bodyFat !== undefined
    ? Number(input.bodyFat)
    : NaN;
  const hasValidBf = !Number.isNaN(parsedBf) && parsedBf >= 3 && parsedBf <= 60;

  let bmr = 0;
  let bmrFormula = 'Mifflin-St Jeor';
  let leanMass = null;

  if (hasValidBf) {
    leanMass = weight * (1 - parsedBf / 100);
    bmr = 370 + 21.6 * leanMass;
    bmrFormula = 'Katch-McArdle';
  } else {
    bmr = 10 * weight + 6.25 * height - 5 * age + (gender === 'male' ? 5 : -161);
    bmrFormula = 'Mifflin-St Jeor';
  }
  bmr = Math.round(bmr);

  // Camada 1: Rotina Diária (NEAT)
  const neatFactor = Number(input.neatFactor) || 1.2;
  const neatTdee = bmr * neatFactor;

  // Camada 2: Treinos Estruturados + Gasto Extra Diário
  const trainingDays = Math.min(7, Math.max(0, Number(input.trainingDays) || 0));
  const intensityObj =
    TRAINING_INTENSITY_OPTIONS.find((opt) => opt.id === input.trainingIntensity) ||
    TRAINING_INTENSITY_OPTIONS[1];
  const dailyTrainingBurn = Math.round((trainingDays * intensityObj.kcal) / 7);
  const extraDailyBurn = Math.max(0, Number(input.extraDailyBurn) || 0);

  const tdee = Math.round(neatTdee + dailyTrainingBurn + extraDailyBurn);

  // Objetivo e Ritmo (Superávit / Déficit)
  const goal = input.goal || 'gain';
  const pacePreset = input.pacePreset || 'moderate';
  const customDeltaMag = Math.abs(Number(input.customCalorieDelta) || 0);

  let calorieDelta = 0;
  if (goal === 'gain') {
    if (pacePreset === 'conservative') calorieDelta = 250;
    else if (pacePreset === 'aggressive') calorieDelta = 500;
    else if (pacePreset === 'custom') calorieDelta = customDeltaMag;
    else calorieDelta = 350;
  } else if (goal === 'loss') {
    if (pacePreset === 'conservative') calorieDelta = -300;
    else if (pacePreset === 'aggressive') calorieDelta = -700;
    else if (pacePreset === 'custom') calorieDelta = -customDeltaMag;
    else calorieDelta = -500;
  }

  const parsedOverride =
    input.manualCaloriesOverride !== '' &&
    input.manualCaloriesOverride !== null &&
    input.manualCaloriesOverride !== undefined
      ? Number(input.manualCaloriesOverride)
      : NaN;
  const isManualOverride = !Number.isNaN(parsedOverride) && parsedOverride >= 800;

  const targetCalories = isManualOverride
    ? Math.round(parsedOverride)
    : Math.max(1200, Math.round(tdee + calorieDelta));
  const effectiveDelta = targetCalories - tdee;

  // Distribuição Personalizada de Macronutrientes e Água
  const proteinPerKg = Math.min(3.5, Math.max(1.0, Number(input.proteinPerKg) || 2.0));
  const fatPerKg = Math.min(2.0, Math.max(0.4, Number(input.fatPerKg) || 0.9));
  const waterMlPerKg = Math.min(60, Math.max(25, Number(input.waterMlPerKg) || 38));

  const protein = Math.round(weight * proteinPerKg);
  const fats = Math.round(weight * fatPerKg);
  const carbCalories = targetCalories - protein * 4 - fats * 9;
  const carbs = Math.max(50, Math.round(carbCalories / 4));

  const rawWater = weight * waterMlPerKg + (trainingDays >= 3 ? 300 : 0);
  const water = Math.round(rawWater / 50) * 50;

  return {
    calories: targetCalories,
    protein,
    carbs,
    fats,
    water,
    bmr,
    tdee,
    dailyTrainingBurn,
    extraDailyBurn,
    bmrFormula,
    leanMass: leanMass ? Number(leanMass.toFixed(1)) : null,
    calorieDelta: effectiveDelta,
    isManualOverride
  };
};

// Chamada à API Gemini com Exponential Backoff
const fetchGeminiWithBackoff = async (url, payload, maxRetries = 3) => {
  let delay = 1000;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (response.ok) {
        return await response.json();
      }
      if (response.status === 429 || response.status >= 500) {
        if (attempt < maxRetries) {
          await new Promise((res) => setTimeout(res, delay));
          delay *= 2;
          continue;
        }
      }
      const errText = await response.text();
      throw new Error(`Erro HTTP ${response.status}: ${errText}`);
    } catch (err) {
      if (attempt < maxRetries) {
        await new Promise((res) => setTimeout(res, delay));
        delay *= 2;
      } else {
        throw err;
      }
    }
  }
};

const MEAL_SECTIONS = [
  { name: 'Café da Manhã', icon: Coffee, color: 'text-amber-400' },
  { name: 'Lanche da Manhã', icon: Apple, color: 'text-red-400' },
  { name: 'Almoço', icon: Utensils, color: 'text-orange-500' },
  { name: 'Lanche da Tarde', icon: Sun, color: 'text-yellow-500' },
  { name: 'Jantar', icon: Moon, color: 'text-indigo-400' },
  { name: 'Outros', icon: Plus, color: 'text-slate-400' }
];

// ==========================================
// FORMULÁRIO UNIFICADO DE PERFIL E METAS
// ==========================================
const ProfileForm = ({ initialProfile = null, mode = 'onboarding', onSubmit, onCancel }) => {
  const [formData, setFormData] = useState(() => normalizeProfileFormData(initialProfile));

  const preview = useMemo(() => calculateTargets(formData), [formData]);

  const handleGoalChange = (nextGoal) => {
    setFormData((prev) => ({
      ...prev,
      goal: nextGoal,
      pacePreset: prev.pacePreset === 'custom' ? 'custom' : 'moderate',
      customCalorieDelta: nextGoal === 'loss' ? 400 : 350
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const targets = calculateTargets(formData);
    const cleanedProfile = {
      weight: Number(formData.weight),
      targetWeight: Number(formData.targetWeight),
      height: Number(formData.height),
      age: Number(formData.age),
      gender: formData.gender,
      bodyFat: formData.bodyFat === '' ? null : Number(formData.bodyFat),
      neatFactor: Number(formData.neatFactor),
      trainingDays: Number(formData.trainingDays),
      trainingIntensity: formData.trainingIntensity,
      extraDailyBurn: Number(formData.extraDailyBurn) || 0,
      goal: formData.goal,
      pacePreset: formData.pacePreset,
      customCalorieDelta: Number(formData.customCalorieDelta) || 0,
      manualCaloriesOverride:
        formData.manualCaloriesOverride === '' ? null : Number(formData.manualCaloriesOverride),
      proteinPerKg: Number(formData.proteinPerKg),
      fatPerKg: Number(formData.fatPerKg),
      waterMlPerKg: Number(formData.waterMlPerKg),
      targets
    };
    onSubmit(cleanedProfile);
  };

  const deltaLabel =
    preview.calorieDelta > 0
      ? `+${preview.calorieDelta} kcal`
      : preview.calorieDelta < 0
      ? `${preview.calorieDelta} kcal`
      : 'Manutenção';

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* CARD DE PRÉ-VISUALIZAÇÃO EM TEMPO REAL (LIVE PREVIEW) */}
      <div className="sticky top-0 z-20 bg-slate-900/95 backdrop-blur-md border border-emerald-500/35 rounded-2xl p-4 shadow-xl">
        <div className="flex items-center justify-between gap-2 mb-2.5">
          <div className="flex items-center gap-1.5">
            <Flame className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
              Prévia em Tempo Real
            </span>
          </div>
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
            {preview.bmrFormula}
          </span>
        </div>

        <div className="flex items-end justify-between gap-2 pb-3 border-b border-slate-800">
          <div>
            <span className="text-[10px] text-slate-400 block">Meta Diária Final</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-extrabold text-white">{preview.calories}</span>
              <span className="text-xs text-slate-400">kcal</span>
              <span
                className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                  preview.calorieDelta > 0
                    ? 'bg-emerald-500/15 text-emerald-400'
                    : preview.calorieDelta < 0
                    ? 'bg-rose-500/15 text-rose-400'
                    : 'bg-slate-800 text-slate-300'
                }`}
              >
                {deltaLabel}
              </span>
            </div>
          </div>
          <div className="text-right text-[11px] text-slate-400 leading-tight">
            <div>
              TMB: <strong className="text-slate-200">{preview.bmr}</strong> kcal
            </div>
            <div>
              GET: <strong className="text-slate-200">{preview.tdee}</strong> kcal
            </div>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2 pt-2.5 text-center">
          <div>
            <span className="block text-sm font-bold text-blue-400">{preview.protein}g</span>
            <span className="text-[9px] text-slate-400 uppercase">Prot</span>
          </div>
          <div>
            <span className="block text-sm font-bold text-amber-400">{preview.carbs}g</span>
            <span className="text-[9px] text-slate-400 uppercase">Carb</span>
          </div>
          <div>
            <span className="block text-sm font-bold text-rose-400">{preview.fats}g</span>
            <span className="text-[9px] text-slate-400 uppercase">Gord</span>
          </div>
          <div>
            <span className="block text-sm font-bold text-cyan-400">{preview.water}ml</span>
            <span className="text-[9px] text-slate-400 uppercase">Água</span>
          </div>
        </div>
      </div>

      {/* SEÇÃO 1: DADOS CORPORAIS */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3.5">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
          <User className="w-4 h-4 text-emerald-400" /> 1. Dados Corporais
        </h3>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] text-slate-400 ml-1 block mb-1">Peso Atual (kg)</label>
            <input
              type="number"
              step="0.1"
              min="30"
              max="300"
              required
              value={formData.weight}
              onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:border-emerald-500 outline-none"
            />
          </div>
          <div>
            <label className="text-[11px] text-emerald-400 ml-1 block mb-1 font-medium">
              Meta de Peso (kg)
            </label>
            <input
              type="number"
              step="0.1"
              min="30"
              max="300"
              required
              value={formData.targetWeight}
              onChange={(e) => setFormData({ ...formData, targetWeight: e.target.value })}
              className="w-full bg-slate-950 border border-emerald-500/40 rounded-xl px-3.5 py-2.5 text-sm text-white focus:border-emerald-400 outline-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2.5">
          <div>
            <label className="text-[11px] text-slate-400 ml-1 block mb-1">Altura (cm)</label>
            <input
              type="number"
              min="100"
              max="250"
              required
              value={formData.height}
              onChange={(e) => setFormData({ ...formData, height: e.target.value })}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:border-emerald-500 outline-none"
            />
          </div>
          <div>
            <label className="text-[11px] text-slate-400 ml-1 block mb-1">Idade</label>
            <input
              type="number"
              min="12"
              max="110"
              required
              value={formData.age}
              onChange={(e) => setFormData({ ...formData, age: e.target.value })}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:border-emerald-500 outline-none"
            />
          </div>
          <div>
            <label className="text-[11px] text-slate-400 ml-1 block mb-1">Gênero</label>
            <select
              value={formData.gender}
              onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-2.5 text-sm text-white focus:border-emerald-500 outline-none"
            >
              <option value="male">Masc.</option>
              <option value="female">Fem.</option>
            </select>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1 ml-1">
            <label className="text-[11px] text-slate-400">
              % de Gordura Corporal - BF% (Opcional)
            </label>
            {preview.leanMass && (
              <span className="text-[10px] text-emerald-400 font-medium">
                Massa Magra: {preview.leanMass} kg
              </span>
            )}
          </div>
          <input
            type="number"
            step="0.5"
            min="3"
            max="60"
            value={formData.bodyFat}
            onChange={(e) => setFormData({ ...formData, bodyFat: e.target.value })}
            placeholder="Deixe vazio para Mifflin-St Jeor (ex: 14)"
            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-emerald-500 outline-none"
          />
        </div>
      </div>

      {/* SEÇÃO 2: ROTINA E TREINO */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
          <Dumbbell className="w-4 h-4 text-emerald-400" /> 2. Rotina e Treino
        </h3>

        <div>
          <label className="text-[11px] text-slate-400 ml-1 block mb-1.5">
            Atividade Diária / Trabalho (NEAT)
          </label>
          <select
            value={formData.neatFactor}
            onChange={(e) => setFormData({ ...formData, neatFactor: Number(e.target.value) })}
            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:border-emerald-500 outline-none"
          >
            {NEAT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label} ({opt.value}x) — {opt.desc}
              </option>
            ))}
          </select>
        </div>

        <div>
          <div className="flex justify-between items-center mb-1.5 px-1">
            <label className="text-[11px] text-slate-400">Dias de Treino por Semana</label>
            <span className="text-xs font-bold text-emerald-400">
              {formData.trainingDays} {Number(formData.trainingDays) === 1 ? 'dia' : 'dias'}/sem
              {preview.dailyTrainingBurn > 0 && ` (+${preview.dailyTrainingBurn} kcal/dia)`}
            </span>
          </div>
          <div className="grid grid-cols-8 gap-1">
            {[0, 1, 2, 3, 4, 5, 6, 7].map((day) => (
              <button
                key={day}
                type="button"
                onClick={() => setFormData({ ...formData, trainingDays: day })}
                className={`py-2 rounded-xl text-xs font-bold border transition ${
                  Number(formData.trainingDays) === day
                    ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-600'
                }`}
              >
                {day}
              </button>
            ))}
          </div>
        </div>

        {Number(formData.trainingDays) > 0 && (
          <div>
            <label className="text-[11px] text-slate-400 ml-1 block mb-1.5">
              Intensidade Média dos Treinos
            </label>
            <div className="grid grid-cols-3 gap-2">
              {TRAINING_INTENSITY_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setFormData({ ...formData, trainingIntensity: opt.id })}
                  className={`p-2.5 rounded-xl border text-center transition ${
                    formData.trainingIntensity === opt.id
                      ? 'bg-emerald-500/15 border-emerald-500 text-white'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <span className="block text-xs font-bold">{opt.label}</span>
                  <span className="block text-[10px] text-slate-400 mt-0.5">{opt.desc}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          <label className="text-[11px] text-slate-400 ml-1 block mb-1">
            Gasto Extra Diário Opcional (kcal) — ex: caminhadas, cardio
          </label>
          <input
            type="number"
            min="0"
            max="2000"
            step="10"
            value={formData.extraDailyBurn}
            onChange={(e) => setFormData({ ...formData, extraDailyBurn: e.target.value })}
            placeholder="0"
            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:border-emerald-500 outline-none"
          />
        </div>
      </div>

      {/* SEÇÃO 3: OBJETIVO E RITMO */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
          <Target className="w-4 h-4 text-emerald-400" /> 3. Objetivo e Ritmo
        </h3>

        <div className="grid grid-cols-3 gap-2.5">
          {[
            { id: 'loss', label: 'Perder', Icon: TrendingDown },
            { id: 'maintain', label: 'Manter', Icon: Minus },
            { id: 'gain', label: 'Ganhar', Icon: TrendingUp }
          ].map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => handleGoalChange(id)}
              className={`p-3 rounded-xl border text-center transition-all ${
                formData.goal === id
                  ? 'border-emerald-500 bg-emerald-500/10 text-white'
                  : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700'
              }`}
            >
              <Icon
                className={`w-5 h-5 mx-auto mb-1 ${
                  formData.goal === id ? 'text-emerald-400' : 'text-slate-500'
                }`}
              />
              <span className="text-xs font-semibold">{label}</span>
            </button>
          ))}
        </div>

        {formData.goal !== 'maintain' && (
          <div className="space-y-3">
            <label className="text-[11px] text-slate-400 ml-1 block">
              Ritmo de {formData.goal === 'gain' ? 'Superávit' : 'Déficit'} Calórico
            </label>
            <div className="grid grid-cols-2 gap-2">
              {PACE_PRESETS[formData.goal].map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setFormData({ ...formData, pacePreset: preset.id })}
                  className={`p-2.5 rounded-xl border text-left transition ${
                    formData.pacePreset === preset.id
                      ? 'bg-emerald-500/15 border-emerald-500 text-white'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <span className="block text-xs font-bold">{preset.label}</span>
                  <span className="block text-[10px] text-slate-400">{preset.desc}</span>
                </button>
              ))}
            </div>

            {formData.pacePreset === 'custom' && (
              <div>
                <label className="text-[11px] text-emerald-400 ml-1 block mb-1">
                  {formData.goal === 'gain' ? 'Superávit' : 'Déficit'} Personalizado (kcal/dia)
                </label>
                <input
                  type="number"
                  min="0"
                  max="1500"
                  step="25"
                  value={formData.customCalorieDelta}
                  onChange={(e) =>
                    setFormData({ ...formData, customCalorieDelta: e.target.value })
                  }
                  className="w-full bg-slate-950 border border-emerald-500/40 rounded-xl px-3.5 py-2.5 text-sm text-white focus:border-emerald-400 outline-none"
                />
              </div>
            )}
          </div>
        )}

        <div>
          <label className="text-[11px] text-slate-400 ml-1 block mb-1">
            Ajuste Manual de Calorias (Opcional — sobrescreve o cálculo automático)
          </label>
          <input
            type="number"
            min="800"
            max="8000"
            step="10"
            value={formData.manualCaloriesOverride}
            onChange={(e) =>
              setFormData({ ...formData, manualCaloriesOverride: e.target.value })
            }
            placeholder="Deixe vazio para usar o cálculo automático"
            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-emerald-500 outline-none"
          />
        </div>
      </div>

      {/* SEÇÃO 4: AJUSTE FINO DE MACROS E HIDRATAÇÃO */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-emerald-400" /> 4. Macros e Hidratação
        </h3>

        {/* Proteína g/kg */}
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-blue-400 font-semibold">Proteína ({formData.proteinPerKg} g/kg)</span>
            <span className="text-slate-300 font-bold">{preview.protein} g/dia</span>
          </div>
          <input
            type="range"
            min="1.4"
            max="2.8"
            step="0.1"
            value={formData.proteinPerKg}
            onChange={(e) => setFormData({ ...formData, proteinPerKg: Number(e.target.value) })}
            className="w-full accent-blue-500 cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-slate-500">
            <span>1.4 g/kg</span>
            <span>2.0 g/kg</span>
            <span>2.8 g/kg</span>
          </div>
        </div>

        {/* Gordura g/kg */}
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-rose-400 font-semibold">Gorduras ({formData.fatPerKg} g/kg)</span>
            <span className="text-slate-300 font-bold">{preview.fats} g/dia</span>
          </div>
          <input
            type="range"
            min="0.6"
            max="1.3"
            step="0.05"
            value={formData.fatPerKg}
            onChange={(e) => setFormData({ ...formData, fatPerKg: Number(e.target.value) })}
            className="w-full accent-rose-500 cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-slate-500">
            <span>0.6 g/kg</span>
            <span>0.9 g/kg</span>
            <span>1.3 g/kg</span>
          </div>
        </div>

        {/* Água ml/kg */}
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-cyan-400 font-semibold">Água ({formData.waterMlPerKg} ml/kg)</span>
            <span className="text-slate-300 font-bold">
              {preview.water} ml/dia
              {Number(formData.trainingDays) >= 3 && (
                <span className="text-[10px] text-cyan-400 font-normal"> (+300ml treino)</span>
              )}
            </span>
          </div>
          <input
            type="range"
            min="30"
            max="50"
            step="1"
            value={formData.waterMlPerKg}
            onChange={(e) => setFormData({ ...formData, waterMlPerKg: Number(e.target.value) })}
            className="w-full accent-cyan-500 cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-slate-500">
            <span>30 ml/kg</span>
            <span>40 ml/kg</span>
            <span>50 ml/kg</span>
          </div>
        </div>

        <p className="text-[11px] text-slate-400 bg-slate-950/70 border border-slate-800 rounded-xl p-2.5">
          Os <strong className="text-amber-400">Carboidratos ({preview.carbs}g)</strong> são
          calculados automaticamente com as calorias restantes da sua meta.
        </p>
      </div>

      {/* BOTÕES DE AÇÃO */}
      <div className="flex gap-2.5 pt-1">
        {mode === 'edit' && onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-semibold py-3.5 rounded-xl transition text-sm"
          >
            Cancelar
          </button>
        )}
        <button
          type="submit"
          className="flex-[2] bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-3.5 rounded-xl transition-all shadow-[0_4px_20px_rgba(16,185,129,0.3)] text-sm"
        >
          {mode === 'edit' ? 'Salvar Alterações e Metas' : 'Gerar Plano Nutricional'}
        </button>
      </div>
    </form>
  );
};

// ==========================================
// COMPONENTE PRINCIPAL
// ==========================================
export default function App() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentScreen, setCurrentScreen] = useState('auth'); // auth | setup | dashboard
  const [activeTab, setActiveTab] = useState('today'); // today | history | evolution
  const [dateString, setDateString] = useState(getLocalDateString());

  // Estados dos 3 Bancos de Dados Adicionais (assinados em tempo real)
  const [savedMeals, setSavedMeals] = useState([]);
  const [allLogsMap, setAllLogsMap] = useState({}); // { 'YYYY-MM-DD': logData }
  const [weightLogs, setWeightLogs] = useState([]); // ordenado crescente por data

  // Estados de UI e Modais
  const [toast, setToast] = useState({ show: false, message: '', type: 'info' });
  const [showMealModal, setShowMealModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [selectedMealSection, setSelectedMealSection] = useState('Almoço');
  const [apiKey, setApiKey] = useState(() => {
    try {
      return window.localStorage?.getItem('gemini_api_key') || '';
    } catch {
      return '';
    }
  });

  const showToast = (message, type = 'info') => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast((prev) => (prev.message === message ? { show: false, message: '', type: 'info' } : prev));
    }, 3500);
  };

  // 1. Inicialização da Autenticação
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        }
      } catch (err) {
        console.error('Auth init error:', err);
      }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        await loadProfile(currentUser.uid);
      } else {
        setProfile(null);
        setSavedMeals([]);
        setAllLogsMap({});
        setWeightLogs([]);
        setCurrentScreen('auth');
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  // 2. Assinatura em Tempo Real: Perfil, Refeições Frequentes, Logs Diários e Pesagens
  useEffect(() => {
    if (!user || currentScreen !== 'dashboard') return;

    // 2a. Perfil em tempo real
    const profileRef = doc(db, 'artifacts', appId, 'users', user.uid);
    const unsubProfile = onSnapshot(
      profileRef,
      (snap) => {
        if (snap.exists()) {
          setProfile(snap.data());
        }
      },
      (error) => console.error('Erro no snapshot do perfil:', error)
    );

    // 2b. Banco de Refeições Frequentes (ordenado em memória por usageCount desc)
    const savedMealsRef = collection(db, 'artifacts', appId, 'users', user.uid, 'saved_meals');
    const unsubSavedMeals = onSnapshot(
      savedMealsRef,
      (snapshot) => {
        const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        list.sort((a, b) => {
          const diffUsage = (b.usageCount || 0) - (a.usageCount || 0);
          if (diffUsage !== 0) return diffUsage;
          return (b.lastUsed || 0) - (a.lastUsed || 0);
        });
        setSavedMeals(list);
      },
      (error) => {
        console.error('Erro ao carregar refeições frequentes:', error);
      }
    );

    // 2c. Banco de Registros Diários (logs)
    const logsRef = collection(db, 'artifacts', appId, 'users', user.uid, 'logs');
    const unsubLogs = onSnapshot(
      logsRef,
      (snapshot) => {
        const map = {};
        snapshot.docs.forEach((d) => {
          map[d.id] = { date: d.id, ...d.data() };
        });
        setAllLogsMap(map);
        setLoading(false);
      },
      (error) => {
        console.error('Erro ao carregar logs diários:', error);
        showToast('Erro ao sincronizar histórico de refeições.', 'error');
        setLoading(false);
      }
    );

    // 2d. Banco de Evolução Corporal (weight_logs) - ordenado por data crescente
    const weightLogsRef = collection(db, 'artifacts', appId, 'users', user.uid, 'weight_logs');
    const unsubWeights = onSnapshot(
      weightLogsRef,
      (snapshot) => {
        const list = snapshot.docs.map((d) => ({
          id: d.id,
          date: d.id,
          ...d.data()
        }));
        list.sort((a, b) => a.date.localeCompare(b.date));
        setWeightLogs(list);
      },
      (error) => {
        console.error('Erro ao carregar pesagens:', error);
      }
    );

    return () => {
      unsubProfile();
      unsubSavedMeals();
      unsubLogs();
      unsubWeights();
    };
  }, [user, currentScreen]);

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
      showToast('Erro ao carregar perfil.', 'error');
      setLoading(false);
    }
  };

  // Log do dia selecionado atualmente na tela "Hoje"
  const currentDayLog = useMemo(() => {
    return (
      allLogsMap[dateString] || {
        date: dateString,
        water: 0,
        meals: [],
        totals: { calories: 0, protein: 0, carbs: 0, fats: 0 }
      }
    );
  }, [allLogsMap, dateString]);

  // ==========================================
  // AÇÕES DE ESCRITA NO FIRESTORE
  // ==========================================
  const handleSaveProfile = async (profileData) => {
    if (!user) return;
    setLoading(true);
    try {
      const today = getLocalDateString();
      const payload = {
        ...profileData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      await setDoc(doc(db, 'artifacts', appId, 'users', user.uid), payload);
      // Também cria o primeiro registro na coleção weight_logs
      await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'weight_logs', today), {
        date: today,
        weight: Number(profileData.weight),
        timestamp: Date.now()
      });
      setProfile(payload);
      setCurrentScreen('dashboard');
      showToast('Perfil configurado com sucesso!', 'success');
    } catch (err) {
      console.error(err);
      showToast('Erro ao salvar perfil.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProfile = async (updatedData) => {
    if (!user) return;
    try {
      const mergedProfile = {
        ...profile,
        ...updatedData,
        createdAt: profile?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      const profileRef = doc(db, 'artifacts', appId, 'users', user.uid);
      await setDoc(profileRef, mergedProfile, { merge: true });

      // Se o peso atual foi alterado na edição, sincroniza na pesagem de hoje
      if (Number(updatedData.weight) !== Number(profile?.weight)) {
        const today = getLocalDateString();
        await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'weight_logs', today), {
          date: today,
          weight: Number(updatedData.weight),
          timestamp: Date.now()
        });
      }

      setProfile(mergedProfile);
      setShowProfileModal(false);
      showToast('Perfil e metas nutricionais atualizados!', 'success');
    } catch (err) {
      console.error(err);
      showToast('Erro ao atualizar perfil.', 'error');
    }
  };

  const updateTargetWeight = async (newTargetWeight) => {
    if (!user || !profile) return;
    const numericTarget = Number(newTargetWeight);
    if (!numericTarget || numericTarget <= 0) {
      showToast('Informe uma meta de peso válida.', 'error');
      return;
    }
    try {
      const profileRef = doc(db, 'artifacts', appId, 'users', user.uid);
      await updateDoc(profileRef, { targetWeight: numericTarget });
      setProfile((prev) => ({ ...prev, targetWeight: numericTarget }));
      showToast(`Meta atualizada para ${numericTarget.toFixed(1)} kg!`, 'success');
    } catch (e) {
      console.error(e);
      showToast('Erro ao atualizar meta de peso.', 'error');
    }
  };

  const addWater = async (amount) => {
    if (!user) return;
    const logRef = doc(db, 'artifacts', appId, 'users', user.uid, 'logs', dateString);
    const updatedWater = Math.max(0, (currentDayLog.water || 0) + amount);
    try {
      await setDoc(
        logRef,
        {
          date: dateString,
          water: updatedWater,
          meals: currentDayLog.meals || [],
          totals: currentDayLog.totals || { calories: 0, protein: 0, carbs: 0, fats: 0 }
        },
        { merge: true }
      );
    } catch (e) {
      console.error(e);
      showToast('Erro ao atualizar água.', 'error');
    }
  };

  const computeTotals = (mealsList) => {
    return mealsList.reduce(
      (acc, m) => ({
        calories: acc.calories + Math.round(Number(m.calories) || 0),
        protein: acc.protein + Math.round(Number(m.protein) || 0),
        carbs: acc.carbs + Math.round(Number(m.carbs) || 0),
        fats: acc.fats + Math.round(Number(m.fats) || 0)
      }),
      { calories: 0, protein: 0, carbs: 0, fats: 0 }
    );
  };

  const saveMealToDay = async (mealData, { saveToLibrary = false, existingSavedMeal = null } = {}) => {
    if (!user) return;
    const logRef = doc(db, 'artifacts', appId, 'users', user.uid, 'logs', dateString);
    const mealWithId = {
      id: mealData.id || `meal_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      name: mealData.name,
      calories: Math.round(Number(mealData.calories) || 0),
      protein: Math.round(Number(mealData.protein) || 0),
      carbs: Math.round(Number(mealData.carbs) || 0),
      fats: Math.round(Number(mealData.fats) || 0),
      section: mealData.section || selectedMealSection,
      timestamp: Date.now()
    };

    const newMeals = [...(currentDayLog.meals || []), mealWithId];
    const newTotals = computeTotals(newMeals);

    try {
      await setDoc(
        logRef,
        {
          date: dateString,
          water: currentDayLog.water || 0,
          meals: newMeals,
          totals: newTotals
        },
        { merge: true }
      );

      // Atualiza ou cria no banco de refeições frequentes
      if (existingSavedMeal) {
        const savedRef = doc(db, 'artifacts', appId, 'users', user.uid, 'saved_meals', existingSavedMeal.id);
        await updateDoc(savedRef, {
          usageCount: (existingSavedMeal.usageCount || 1) + 1,
          lastUsed: Date.now()
        });
      } else if (saveToLibrary) {
        // Verifica se já existe uma refeição com o mesmo nome (case-insensitive)
        const normalized = mealWithId.name.trim().toLowerCase();
        const duplicate = savedMeals.find((m) => m.name.trim().toLowerCase() === normalized);
        if (duplicate) {
          const savedRef = doc(db, 'artifacts', appId, 'users', user.uid, 'saved_meals', duplicate.id);
          await updateDoc(savedRef, {
            calories: mealWithId.calories,
            protein: mealWithId.protein,
            carbs: mealWithId.carbs,
            fats: mealWithId.fats,
            defaultSection: mealWithId.section,
            usageCount: (duplicate.usageCount || 1) + 1,
            lastUsed: Date.now()
          });
        } else {
          const savedColRef = collection(db, 'artifacts', appId, 'users', user.uid, 'saved_meals');
          await addDoc(savedColRef, {
            name: mealWithId.name,
            calories: mealWithId.calories,
            protein: mealWithId.protein,
            carbs: mealWithId.carbs,
            fats: mealWithId.fats,
            defaultSection: mealWithId.section,
            usageCount: 1,
            lastUsed: Date.now()
          });
        }
      }

      setShowMealModal(false);
      showToast('Refeição registrada!', 'success');
    } catch (e) {
      console.error(e);
      showToast('Erro ao salvar refeição.', 'error');
    }
  };

  const removeMealFromDay = async (mealIndexOrId) => {
    if (!user) return;
    const logRef = doc(db, 'artifacts', appId, 'users', user.uid, 'logs', dateString);
    const currentMeals = currentDayLog.meals || [];
    const newMeals = currentMeals.filter((m, idx) =>
      m.id ? m.id !== mealIndexOrId : idx !== mealIndexOrId
    );
    const newTotals = computeTotals(newMeals);

    try {
      await setDoc(
        logRef,
        {
          date: dateString,
          water: currentDayLog.water || 0,
          meals: newMeals,
          totals: newTotals
        },
        { merge: true }
      );
      showToast('Refeição removida.', 'info');
    } catch (e) {
      console.error(e);
      showToast('Erro ao remover refeição.', 'error');
    }
  };

  const deleteSavedMeal = async (savedMealId) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'saved_meals', savedMealId));
      showToast('Refeição removida dos frequentes.', 'info');
    } catch (e) {
      console.error(e);
      showToast('Erro ao remover refeição frequente.', 'error');
    }
  };

  const saveWeightLog = async (weightValue, logDate) => {
    if (!user || !profile) return;
    const numericWeight = Number(weightValue);
    if (!numericWeight || numericWeight <= 0) {
      showToast('Informe um peso válido.', 'error');
      return;
    }
    const targetDate = logDate || getLocalDateString();
    try {
      const weightRef = doc(db, 'artifacts', appId, 'users', user.uid, 'weight_logs', targetDate);
      await setDoc(weightRef, {
        date: targetDate,
        weight: numericWeight,
        timestamp: Date.now()
      });

      // Atualiza o peso atual no perfil se esta data for a mais recente ou igual à última
      const latestExistingDate = weightLogs.length > 0 ? weightLogs[weightLogs.length - 1].date : '';
      if (!latestExistingDate || targetDate >= latestExistingDate) {
        const profileRef = doc(db, 'artifacts', appId, 'users', user.uid);
        await updateDoc(profileRef, { weight: numericWeight });
        setProfile((prev) => ({ ...prev, weight: numericWeight }));
      }

      showToast('Pesagem registrada com sucesso!', 'success');
    } catch (e) {
      console.error(e);
      showToast('Erro ao salvar pesagem.', 'error');
    }
  };

  const deleteWeightLog = async (logDate) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'weight_logs', logDate));
      const remaining = weightLogs.filter((w) => w.date !== logDate);
      if (remaining.length > 0) {
        const latest = remaining[remaining.length - 1];
        await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid), { weight: latest.weight });
      }
      showToast('Registro de peso excluído.', 'info');
    } catch (e) {
      console.error(e);
      showToast('Erro ao excluir pesagem.', 'error');
    }
  };

  // ==========================================
  // COMPONENTES DE UI AUXILIARES E MODAIS
  // ==========================================
  const Toast = () => {
    if (!toast.show) return null;
    const colors = {
      success: 'bg-emerald-950/95 border-emerald-500/60 text-emerald-100',
      error: 'bg-rose-950/95 border-rose-500/60 text-rose-100',
      info: 'bg-slate-800/95 border-slate-600 text-slate-100'
    };
    const Icon = toast.type === 'success' ? Check : toast.type === 'error' ? AlertCircle : Info;

    return (
      <div
        className={`fixed top-4 left-1/2 transform -translate-x-1/2 z-50 flex items-center px-4 py-3 rounded-xl border shadow-2xl backdrop-blur-md ${colors[toast.type]} transition-all duration-300 max-w-[90vw] min-w-[280px]`}
      >
        <Icon className="w-5 h-5 mr-3 shrink-0" />
        <span className="text-sm font-medium">{toast.message}</span>
      </div>
    );
  };

  const SettingsModal = () => {
    const [tempKey, setTempKey] = useState(apiKey);
    if (!showSettingsModal) return null;

    const saveSettings = () => {
      setApiKey(tempKey.trim());
      try {
        window.localStorage?.setItem('gemini_api_key', tempKey.trim());
      } catch {
        // Ignora caso storage não esteja disponível no iframe
      }
      setShowSettingsModal(false);
      showToast('Configurações salvas!', 'success');
    };

    return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-slate-900 border border-slate-700 w-full max-w-sm rounded-3xl p-6 shadow-2xl relative">
          <button
            onClick={() => setShowSettingsModal(false)}
            className="absolute top-4 right-4 text-slate-400 hover:text-white p-1"
          >
            <X className="w-5 h-5" />
          </button>
          <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <Settings className="text-emerald-400 w-5 h-5" /> Configurações
          </h3>

          <div className="space-y-4">
            <button
              type="button"
              onClick={() => {
                setShowSettingsModal(false);
                setShowProfileModal(true);
              }}
              className="w-full bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 font-semibold py-3 px-4 rounded-xl transition flex items-center justify-between text-sm"
            >
              <span className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-emerald-400" />
                Editar Perfil e Metas
              </span>
              <ChevronRight className="w-4 h-4" />
            </button>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5 ml-1">
                Chave da API Gemini (Opcional)
              </label>
              <input
                type="password"
                value={tempKey}
                onChange={(e) => setTempKey(e.target.value)}
                placeholder="Insira sua API Key do Gemini..."
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 text-sm"
              />
              <p className="text-[11px] text-slate-500 mt-2 leading-relaxed">
                Se deixado em branco, o aplicativo utilizará a chave padrão do ambiente.
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowSettingsModal(false)}
                className="flex-1 bg-slate-800 hover:bg-slate-700 text-white py-3 rounded-xl transition text-sm font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={saveSettings}
                className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-3 rounded-xl transition text-sm"
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const ProfileEditModal = () => {
    if (!showProfileModal || !profile) return null;

    return (
      <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
        <div className="bg-slate-950 border border-slate-800 w-full max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl relative max-h-[92vh] flex flex-col">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 shrink-0">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <SlidersHorizontal className="w-5 h-5 text-emerald-400" />
                Editar Perfil e Metas
              </h3>
              <p className="text-xs text-slate-400">
                Ajuste seus dados para recalcular calorias e macros
              </p>
            </div>
            <button
              onClick={() => setShowProfileModal(false)}
              className="text-slate-400 hover:text-white p-2 rounded-full bg-slate-900 border border-slate-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="overflow-y-auto p-4 flex-1">
            <ProfileForm
              initialProfile={profile}
              mode="edit"
              onSubmit={handleUpdateProfile}
              onCancel={() => setShowProfileModal(false)}
            />
          </div>
        </div>
      </div>
    );
  };

  // ==========================================
  // MODAL DE ADICIONAR REFEIÇÃO (3 ABAS)
  // ==========================================
  const MealModal = () => {
    const [modalTab, setModalTab] = useState(savedMeals.length > 0 ? 'frequent' : 'ai');
    const [searchQuery, setSearchQuery] = useState('');

    // Estado da Aba IA
    const [aiInput, setAiInput] = useState('');
    const [aiResult, setAiResult] = useState(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [saveAiToLibrary, setSaveAiToLibrary] = useState(true);

    // Estado da Aba Manual
    const [manualForm, setManualForm] = useState({
      name: '',
      calories: '',
      protein: '',
      carbs: '',
      fats: ''
    });
    const [saveManualToLibrary, setSaveManualToLibrary] = useState(true);

    // Sugestões inteligentes e filtragem para a aba Frequentes
    const { smartSuggestions, filteredMeals } = useMemo(() => {
      const q = searchQuery.trim().toLowerCase();
      const filtered = savedMeals.filter((m) =>
        !q || m.name.toLowerCase().includes(q)
      );

      // Prioriza refeições da mesma seção e com maior usageCount
      const suggestions = [...savedMeals]
        .sort((a, b) => {
          const aMatch = a.defaultSection === selectedMealSection ? 1 : 0;
          const bMatch = b.defaultSection === selectedMealSection ? 1 : 0;
          if (aMatch !== bMatch) return bMatch - aMatch;
          return (b.usageCount || 0) - (a.usageCount || 0);
        })
        .slice(0, 3);

      return { smartSuggestions: suggestions, filteredMeals: filtered };
    }, [savedMeals, searchQuery, selectedMealSection]);

    const analyzeMealWithAI = async () => {
      if (!aiInput.trim()) return showToast('Descreva o que você comeu.', 'error');
      setIsAnalyzing(true);
      setAiResult(null);

      const prompt = `Você é um nutricionista esportivo pragmático focado em hipertrofia e precisão nutricional.
Analise esta refeição: "${aiInput}".
Estime os macronutrientes totais.
Retorne APENAS um objeto JSON válido (sem blocos markdown) contendo exatamente estas chaves:
"name" (nome resumido e claro da refeição em português), "calories" (número inteiro), "protein" (número inteiro em gramas), "carbs" (número inteiro em gramas), "fats" (número inteiro em gramas).`;

      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`;
        const payload = {
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json' }
        };

        const data = await fetchGeminiWithBackoff(url, payload);
        let text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) throw new Error('Resposta vazia da IA');

        text = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const result = JSON.parse(text);

        setAiResult({
          name: result.name || 'Refeição Analisada',
          calories: Math.round(Number(result.calories) || 0),
          protein: Math.round(Number(result.protein) || 0),
          carbs: Math.round(Number(result.carbs) || 0),
          fats: Math.round(Number(result.fats) || 0),
          section: selectedMealSection
        });
      } catch (err) {
        console.error('AI Error:', err);
        showToast('Falha ao analisar com IA. Verifique sua conexão ou chave de API.', 'error');
      } finally {
        setIsAnalyzing(false);
      }
    };

    const handleManualSubmit = (e) => {
      e.preventDefault();
      if (!manualForm.name.trim() || manualForm.calories === '') {
        return showToast('Informe pelo menos o nome e as calorias.', 'error');
      }
      saveMealToDay(
        {
          name: manualForm.name.trim(),
          calories: Number(manualForm.calories) || 0,
          protein: Number(manualForm.protein) || 0,
          carbs: Number(manualForm.carbs) || 0,
          fats: Number(manualForm.fats) || 0,
          section: selectedMealSection
        },
        { saveToLibrary: saveManualToLibrary }
      );
    };

    if (!showMealModal) return null;

    return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40 flex items-end sm:items-center justify-center p-0 sm:p-4">
        <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl relative max-h-[90vh] flex flex-col">
          {/* Cabeçalho do Modal */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Utensils className="text-emerald-400 w-5 h-5" />
                {selectedMealSection}
              </h3>
              <p className="text-xs text-slate-400">Adicione rapidamente ou calcule com IA</p>
            </div>
            <button
              onClick={() => setShowMealModal(false)}
              className="text-slate-400 hover:text-white p-2 rounded-full bg-slate-800/70"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Seletor de 3 Abas */}
          <div className="grid grid-cols-3 gap-1.5 bg-slate-950 p-1 rounded-2xl border border-slate-800 mb-4 shrink-0">
            <button
              onClick={() => setModalTab('frequent')}
              className={`py-2 px-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
                modalTab === 'frequent'
                  ? 'bg-emerald-500 text-slate-950 shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Bookmark className="w-3.5 h-3.5" /> Frequentes
            </button>
            <button
              onClick={() => setModalTab('ai')}
              className={`py-2 px-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
                modalTab === 'ai'
                  ? 'bg-emerald-500 text-slate-950 shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <BrainCircuit className="w-3.5 h-3.5" /> IA (Gemini)
            </button>
            <button
              onClick={() => setModalTab('manual')}
              className={`py-2 px-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
                modalTab === 'manual'
                  ? 'bg-emerald-500 text-slate-950 shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Edit3 className="w-3.5 h-3.5" /> Manual
            </button>
          </div>

          {/* Conteúdo rolável */}
          <div className="overflow-y-auto flex-1 pr-0.5 space-y-4">
            {/* ABA 1: FREQUENTES */}
            {modalTab === 'frequent' && (
              <div className="space-y-4">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar refeição salva..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                {savedMeals.length === 0 ? (
                  <div className="text-center py-8 px-4 bg-slate-950/60 rounded-2xl border border-slate-800/80">
                    <Bookmark className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                    <p className="text-sm font-medium text-slate-300">Nenhuma refeição frequente ainda</p>
                    <p className="text-xs text-slate-500 mt-1 mb-4">
                      Use a aba IA ou Manual e marque "Salvar nas frequentes" para registrar com 1 clique da próxima vez.
                    </p>
                    <button
                      onClick={() => setModalTab('ai')}
                      className="bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 px-4 py-2 rounded-xl text-xs font-semibold transition"
                    >
                      Calcular primeira com IA
                    </button>
                  </div>
                ) : (
                  <>
                    {/* Sugestões Inteligentes */}
                    {!searchQuery && smartSuggestions.length > 0 && (
                      <div>
                        <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-emerald-400 mb-2 px-1">
                          <Sparkles className="w-3.5 h-3.5" /> Sugestões para {selectedMealSection}
                        </div>
                        <div className="space-y-2">
                          {smartSuggestions.map((meal) => (
                            <div
                              key={`sug-${meal.id}`}
                              className="p-3 bg-emerald-500/5 border border-emerald-500/25 rounded-2xl flex items-center justify-between gap-2"
                            >
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-semibold text-white truncate">{meal.name}</p>
                                  <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-emerald-500/15 text-emerald-300 shrink-0">
                                    {meal.usageCount || 1}x
                                  </span>
                                </div>
                                <p className="text-[11px] text-slate-400 mt-0.5">
                                  <strong className="text-slate-200">{meal.calories} kcal</strong> • P:{meal.protein}g • C:{meal.carbs}g • G:{meal.fats}g
                                </p>
                              </div>
                              <button
                                onClick={() =>
                                  saveMealToDay(
                                    { ...meal, section: selectedMealSection },
                                    { existingSavedMeal: meal }
                                  )
                                }
                                className="px-3 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl transition shrink-0 flex items-center gap-1"
                              >
                                <Plus className="w-3.5 h-3.5" /> Adicionar
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Todas as Refeições Frequentes */}
                    <div>
                      <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2 px-1">
                        Sua Biblioteca ({filteredMeals.length})
                      </div>
                      <div className="space-y-2">
                        {filteredMeals.length === 0 ? (
                          <p className="text-xs text-slate-500 text-center py-4">
                            Nenhuma refeição encontrada para "{searchQuery}".
                          </p>
                        ) : (
                          filteredMeals.map((meal) => (
                            <div
                              key={meal.id}
                              className="p-3 bg-slate-950 border border-slate-800 rounded-2xl flex items-center justify-between gap-2"
                            >
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-slate-200 truncate">{meal.name}</p>
                                <p className="text-[11px] text-slate-400 mt-0.5">
                                  {meal.calories} kcal • P:{meal.protein}g • C:{meal.carbs}g • G:{meal.fats}g
                                </p>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  onClick={() => deleteSavedMeal(meal.id)}
                                  title="Excluir dos frequentes"
                                  className="p-2 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() =>
                                    saveMealToDay(
                                      { ...meal, section: selectedMealSection },
                                      { existingSavedMeal: meal }
                                    )
                                  }
                                  className="p-2 bg-emerald-500/15 hover:bg-emerald-500 text-emerald-400 hover:text-slate-950 rounded-xl transition"
                                  title="Adicionar ao dia"
                                >
                                  <Plus className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ABA 2: IA (GEMINI) */}
            {modalTab === 'ai' && (
              <div className="space-y-4">
                <p className="text-xs text-slate-400">
                  Descreva o que você comeu com quantidades aproximadas para a IA estimar os macros.
                </p>
                <textarea
                  value={aiInput}
                  onChange={(e) => setAiInput(e.target.value)}
                  rows={3}
                  placeholder="Ex: 150g de arroz branco, 150g de peito de frango grelhado, 1 concha de feijão e 1 colher de azeite..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors resize-none"
                />

                {!aiResult ? (
                  <button
                    onClick={analyzeMealWithAI}
                    disabled={isAnalyzing}
                    className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isAnalyzing ? (
                      <>
                        <BrainCircuit className="w-5 h-5 animate-pulse" /> Analisando com IA...
                      </>
                    ) : (
                      <>
                        <BrainCircuit className="w-5 h-5" /> Calcular Macros (IA)
                      </>
                    )}
                  </button>
                ) : (
                  <div className="space-y-4">
                    <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4">
                      <h4 className="text-white font-semibold mb-3 pb-2 border-b border-slate-800 text-sm">
                        {aiResult.name}
                      </h4>
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

                    <label className="flex items-center gap-3 p-3 bg-slate-950/70 border border-slate-800 rounded-xl cursor-pointer">
                      <input
                        type="checkbox"
                        checked={saveAiToLibrary}
                        onChange={(e) => setSaveAiToLibrary(e.target.checked)}
                        className="w-4 h-4 accent-emerald-500 rounded"
                      />
                      <span className="text-xs text-slate-300">
                        Salvar no banco de refeições frequentes
                      </span>
                    </label>

                    <div className="flex gap-2">
                      <button
                        onClick={() => setAiResult(null)}
                        className="flex-1 bg-slate-800 hover:bg-slate-700 text-white py-3 rounded-xl transition text-sm font-medium"
                      >
                        Refazer
                      </button>
                      <button
                        onClick={() => saveMealToDay(aiResult, { saveToLibrary: saveAiToLibrary })}
                        className="flex-[2] bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-3 rounded-xl transition text-sm"
                      >
                        Confirmar e Salvar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ABA 3: MANUAL */}
            {modalTab === 'manual' && (
              <form onSubmit={handleManualSubmit} className="space-y-3.5">
                <div>
                  <label className="block text-xs text-slate-400 mb-1 ml-1">Nome da Refeição</label>
                  <input
                    type="text"
                    required
                    value={manualForm.name}
                    onChange={(e) => setManualForm({ ...manualForm, name: e.target.value })}
                    placeholder="Ex: Vitamina de Banana com Aveia e Whey"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1 ml-1">Calorias (kcal)</label>
                    <input
                      type="number"
                      min="0"
                      required
                      value={manualForm.calories}
                      onChange={(e) => setManualForm({ ...manualForm, calories: e.target.value })}
                      placeholder="450"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-blue-400 mb-1 ml-1">Proteína (g)</label>
                    <input
                      type="number"
                      min="0"
                      value={manualForm.protein}
                      onChange={(e) => setManualForm({ ...manualForm, protein: e.target.value })}
                      placeholder="35"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-amber-400 mb-1 ml-1">Carboidratos (g)</label>
                    <input
                      type="number"
                      min="0"
                      value={manualForm.carbs}
                      onChange={(e) => setManualForm({ ...manualForm, carbs: e.target.value })}
                      placeholder="55"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-rose-400 mb-1 ml-1">Gorduras (g)</label>
                    <input
                      type="number"
                      min="0"
                      value={manualForm.fats}
                      onChange={(e) => setManualForm({ ...manualForm, fats: e.target.value })}
                      placeholder="10"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <label className="flex items-center gap-3 p-3 bg-slate-950/70 border border-slate-800 rounded-xl cursor-pointer">
                  <input
                    type="checkbox"
                    checked={saveManualToLibrary}
                    onChange={(e) => setSaveManualToLibrary(e.target.checked)}
                    className="w-4 h-4 accent-emerald-500 rounded"
                  />
                  <span className="text-xs text-slate-300">Salvar nas refeições frequentes</span>
                </label>

                <button
                  type="submit"
                  className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-3.5 rounded-xl transition text-sm"
                >
                  Adicionar Refeição
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    );
  };

  // ==========================================
  // TELA DE AUTENTICAÇÃO
  // ==========================================
  const AuthScreen = () => {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    const handleEmailAuth = async (e) => {
      e.preventDefault();
      if (!email || !password) return showToast('Preencha todos os campos.', 'error');
      setLoading(true);
      try {
        if (isLogin) {
          await signInWithEmailAndPassword(auth, email, password);
        } else {
          await createUserWithEmailAndPassword(auth, email, password);
        }
      } catch (err) {
        showToast(err.message, 'error');
        setLoading(false);
      }
    };

    const handleGuest = async () => {
      setLoading(true);
      try {
        await signInAnonymously(auth);
      } catch (err) {
        showToast(err.message, 'error');
        setLoading(false);
      }
    };

    return (
      <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-emerald-500/20 to-transparent blur-3xl pointer-events-none" />

        <div className="w-full max-w-md z-10">
          <div className="text-center mb-10">
            <div className="w-20 h-20 bg-slate-900 border border-emerald-500/30 rounded-2xl mx-auto flex items-center justify-center text-emerald-400 mb-6 shadow-[0_0_40px_rgba(16,185,129,0.2)]">
              <Activity className="w-10 h-10" />
            </div>
            <h1 className="text-3xl font-extrabold text-white mb-2">
              NutriFit <span className="text-emerald-400">AI</span>
            </h1>
            <p className="text-slate-400">Seu consultor inteligente de nutrição e evolução.</p>
          </div>

          <form onSubmit={handleEmailAuth} className="space-y-4">
            <input
              type="email"
              placeholder="Seu E-mail"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-4 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
            />
            <input
              type="password"
              placeholder="Sua Senha"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-4 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
            />
            <button
              type="submit"
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-lg py-4 rounded-xl transition-all shadow-[0_4px_20px_rgba(16,185,129,0.3)]"
            >
              {isLogin ? 'Entrar' : 'Criar Conta'}
            </button>
          </form>

          <div className="mt-6 flex flex-col gap-4">
            <button
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              className="text-slate-400 text-sm hover:text-white transition"
            >
              {isLogin ? 'Não tem uma conta? Cadastre-se' : 'Já tem conta? Faça login'}
            </button>

            <div className="relative flex py-2 items-center">
              <div className="flex-grow border-t border-slate-800" />
              <span className="flex-shrink-0 mx-4 text-slate-600 text-xs uppercase font-semibold">OU</span>
              <div className="flex-grow border-t border-slate-800" />
            </div>

            <button
              onClick={handleGuest}
              className="w-full bg-slate-800 hover:bg-slate-700 text-white font-medium py-3.5 rounded-xl transition-all border border-slate-700 flex justify-center items-center gap-2"
            >
              <User className="w-4 h-4" /> Entrar como Convidado
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ==========================================
  // TELA DE ONBOARDING
  // ==========================================
  const OnboardingScreen = () => {
    return (
      <div className="min-h-screen bg-slate-950 text-white p-4 pb-16 overflow-y-auto">
        <div className="max-w-md mx-auto">
          <div className="pt-4 pb-5">
            <h2 className="text-2xl font-bold mb-1">Configure seu Perfil</h2>
            <p className="text-slate-400 text-sm">
              Personalize seus dados corporais, rotina de treinos e distribuição de macros.
            </p>
          </div>

          <ProfileForm mode="onboarding" onSubmit={handleSaveProfile} />
        </div>
      </div>
    );
  };

  // ==========================================
  // ABA 1: HOJE (DASHBOARD DIÁRIO)
  // ==========================================
  const TodayView = () => {
    const todayStr = getLocalDateString();
    const isToday = dateString === todayStr;
    const t = profile.targets;
    const c = currentDayLog.totals || { calories: 0, protein: 0, carbs: 0, fats: 0 };
    const remainingCals = Math.max(0, t.calories - c.calories);
    const calPercent = Math.min(100, (c.calories / Math.max(1, t.calories)) * 100);
    const strokeDashoffset = 283 - (283 * calPercent) / 100;

    return (
      <div className="space-y-6">
        {/* Seletor de Data */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-2.5 flex items-center justify-between">
          <button
            onClick={() => setDateString(shiftDateString(dateString, -1))}
            className="w-10 h-10 rounded-xl bg-slate-800/70 hover:bg-slate-800 flex items-center justify-center text-slate-300 transition"
            aria-label="Dia anterior"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <div className="text-center">
            <div className="flex items-center justify-center gap-2">
              <span className="text-sm font-bold text-white capitalize">
                {isToday ? 'Hoje' : formatShortDate(dateString)}
              </span>
              {!isToday && (
                <button
                  onClick={() => setDateString(todayStr)}
                  className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 transition"
                >
                  Voltar p/ Hoje
                </button>
              )}
            </div>
            <p className="text-[11px] text-slate-400 capitalize mt-0.5">{formatFullDatePT(dateString)}</p>
          </div>

          <button
            onClick={() => !isToday && setDateString(shiftDateString(dateString, 1))}
            disabled={isToday}
            className="w-10 h-10 rounded-xl bg-slate-800/70 hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-slate-300 transition"
            aria-label="Próximo dia"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Anel de Calorias */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 relative overflow-hidden">
          <div className="absolute -right-10 -top-10 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="flex justify-center mb-4">
            <div className="relative w-44 h-44 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="45" fill="none" stroke="#1e293b" strokeWidth="8" />
                <circle
                  cx="50"
                  cy="50"
                  r="45"
                  fill="none"
                  stroke={c.calories > t.calories && profile.goal === 'loss' ? '#f43f5e' : '#10b981'}
                  strokeWidth="8"
                  strokeDasharray="283"
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  className="transition-all duration-700 ease-out"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-4xl font-extrabold tracking-tighter">{remainingCals}</span>
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mt-1">
                  {c.calories >= t.calories ? 'Meta Batida' : 'Restantes'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex justify-between px-6 text-sm font-medium">
            <div className="text-center">
              <span className="text-slate-500 text-xs block mb-0.5">Consumido</span>
              <span className="text-white text-lg font-bold">{c.calories} kcal</span>
            </div>
            <div className="text-center">
              <span className="text-slate-500 text-xs block mb-0.5">Meta Diária</span>
              <span className="text-emerald-400 text-lg font-bold">{t.calories} kcal</span>
            </div>
          </div>
        </div>

        {/* Barras de Macros */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { id: 'pro', label: 'Proteína', current: c.protein, target: t.protein, color: 'bg-blue-500' },
            { id: 'carb', label: 'Carboidrato', current: c.carbs, target: t.carbs, color: 'bg-amber-500' },
            { id: 'fat', label: 'Gordura', current: c.fats, target: t.fats, color: 'bg-rose-500' }
          ].map((macro) => (
            <div key={macro.id} className="bg-slate-900 border border-slate-800 p-3 rounded-2xl">
              <span className="text-[11px] font-semibold text-slate-400 block mb-1">{macro.label}</span>
              <div className="text-sm font-bold text-white mb-2">
                {macro.current}
                <span className="text-[10px] font-normal text-slate-500"> / {macro.target}g</span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                <div
                  className={`${macro.color} h-full rounded-full transition-all duration-700`}
                  style={{ width: `${Math.min(100, (macro.current / Math.max(1, macro.target)) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Contador de Água */}
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-3xl flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center border border-cyan-500/20">
              <Droplets className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-sm">Água Consumida</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                <strong className="text-white">{currentDayLog.water || 0}</strong> / {t.water} ml
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {(currentDayLog.water || 0) >= 250 && (
              <button
                onClick={() => addWater(-250)}
                className="w-9 h-9 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 border border-slate-700 transition flex items-center justify-center"
                title="Remover 250ml"
              >
                <Minus className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={() => addWater(250)}
              className="px-3.5 h-9 rounded-full bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-400 border border-cyan-500/30 transition flex items-center gap-1 text-xs font-bold"
            >
              <Plus className="w-3.5 h-3.5" /> 250ml
            </button>
          </div>
        </div>

        {/* Lista de Seções de Refeições */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="font-bold text-base">Refeições</h3>
            <span className="text-xs text-slate-500">
              {savedMeals.length} {savedMeals.length === 1 ? 'salva' : 'salvas'} nos frequentes
            </span>
          </div>

          {MEAL_SECTIONS.map((section) => {
            const mealsInSection = (currentDayLog.meals || []).filter((m) => m.section === section.name);
            const sectionCals = mealsInSection.reduce((acc, curr) => acc + (curr.calories || 0), 0);

            return (
              <div key={section.name} className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                <div className="p-3.5 flex justify-between items-center bg-slate-800/30">
                  <div className="flex items-center gap-3">
                    <section.icon className={`w-5 h-5 ${section.color}`} />
                    <div>
                      <span className="font-semibold text-sm block">{section.name}</span>
                      <span className="text-[11px] text-slate-400">{sectionCals} kcal</span>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedMealSection(section.name);
                      setShowMealModal(true);
                    }}
                    className="text-emerald-400 hover:bg-emerald-500 hover:text-slate-950 w-9 h-9 rounded-full bg-emerald-500/10 flex items-center justify-center transition"
                    title={`Adicionar em ${section.name}`}
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                {mealsInSection.length > 0 && (
                  <div className="border-t border-slate-800 p-2 space-y-2 bg-slate-950/40">
                    {mealsInSection.map((m, idx) => (
                      <div
                        key={m.id || idx}
                        className="p-3 bg-slate-950 rounded-xl flex justify-between items-center gap-2 border border-slate-800/60"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-slate-200 truncate">{m.name}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            P: {m.protein}g • C: {m.carbs}g • G: {m.fats}g
                          </p>
                        </div>
                        <div className="flex items-center gap-2.5 shrink-0">
                          <div className="text-right">
                            <span className="text-sm font-bold block leading-tight">{m.calories}</span>
                            <span className="text-[9px] text-slate-500 uppercase">kcal</span>
                          </div>
                          <button
                            onClick={() => removeMealFromDay(m.id || idx)}
                            className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition"
                            title="Remover refeição"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ==========================================
  // ABA 2: HISTÓRICO (SEMANAL E MENSAL)
  // ==========================================
  const HistoryView = () => {
    const [periodDays, setPeriodDays] = useState(7); // 7 ou 30
    const [hoveredDay, setHoveredDay] = useState(null);
    const t = profile.targets;

    const periodData = useMemo(() => {
      const dates = getPastDateRange(periodDays);
      const series = dates.map((d) => {
        const log = allLogsMap[d];
        const totals = log?.totals || { calories: 0, protein: 0, carbs: 0, fats: 0 };
        const hasEntries = (log?.meals?.length || 0) > 0 || totals.calories > 0;
        return {
          date: d,
          calories: totals.calories || 0,
          protein: totals.protein || 0,
          carbs: totals.carbs || 0,
          fats: totals.fats || 0,
          water: log?.water || 0,
          mealsCount: log?.meals?.length || 0,
          hasEntries
        };
      });

      const loggedDays = series.filter((s) => s.hasEntries);
      const count = loggedDays.length;

      const avgCalories = count > 0 ? Math.round(loggedDays.reduce((a, b) => a + b.calories, 0) / count) : 0;
      const avgProtein = count > 0 ? Math.round(loggedDays.reduce((a, b) => a + b.protein, 0) / count) : 0;
      const avgCarbs = count > 0 ? Math.round(loggedDays.reduce((a, b) => a + b.carbs, 0) / count) : 0;
      const avgFats = count > 0 ? Math.round(loggedDays.reduce((a, b) => a + b.fats, 0) / count) : 0;

      // Adesão conforme objetivo
      const adherentDays = loggedDays.filter((d) => {
        if (profile.goal === 'gain') return d.calories >= t.calories * 0.9;
        if (profile.goal === 'loss') return d.calories <= t.calories * 1.1;
        return d.calories >= t.calories * 0.9 && d.calories <= t.calories * 1.1;
      }).length;

      const adherencePct = count > 0 ? Math.round((adherentDays / count) * 100) : 0;
      const maxCal = Math.max(t.calories * 1.15, ...series.map((s) => s.calories), 1000);

      return {
        series,
        loggedDaysDesc: [...loggedDays].reverse(),
        count,
        avgCalories,
        avgProtein,
        avgCarbs,
        avgFats,
        adherencePct,
        maxCal
      };
    }, [allLogsMap, periodDays, t.calories, profile.goal]);

    const targetLineBottomPct = Math.min(95, (t.calories / periodData.maxCal) * 100);

    return (
      <div className="space-y-6">
        {/* Seletor de Período */}
        <div className="grid grid-cols-2 gap-2 bg-slate-900 p-1.5 rounded-2xl border border-slate-800">
          <button
            onClick={() => {
              setPeriodDays(7);
              setHoveredDay(null);
            }}
            className={`py-2.5 rounded-xl text-xs font-bold transition ${
              periodDays === 7
                ? 'bg-emerald-500 text-slate-950 shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Semanal (7 dias)
          </button>
          <button
            onClick={() => {
              setPeriodDays(30);
              setHoveredDay(null);
            }}
            className={`py-2.5 rounded-xl text-xs font-bold transition ${
              periodDays === 30
                ? 'bg-emerald-500 text-slate-950 shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Mensal (30 dias)
          </button>
        </div>

        {/* Cards de Resumo */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
            <span className="text-[11px] text-slate-400 font-medium block">Média Calorias/dia</span>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-2xl font-extrabold text-white">{periodData.avgCalories}</span>
              <span className="text-xs text-slate-500">kcal</span>
            </div>
            <span className="text-[10px] text-slate-500 mt-1 block">Meta: {t.calories} kcal</span>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
            <span className="text-[11px] text-slate-400 font-medium block">Média Proteína/dia</span>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-2xl font-extrabold text-blue-400">{periodData.avgProtein}</span>
              <span className="text-xs text-slate-500">g</span>
            </div>
            <span className="text-[10px] text-slate-500 mt-1 block">Meta: {t.protein}g</span>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
            <span className="text-[11px] text-slate-400 font-medium block">Adesão à Meta</span>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-2xl font-extrabold text-emerald-400">{periodData.adherencePct}%</span>
            </div>
            <span className="text-[10px] text-slate-500 mt-1 block">
              {profile.goal === 'gain' ? 'Dias ≥ 90% da meta' : 'Dias dentro da meta'}
            </span>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
            <span className="text-[11px] text-slate-400 font-medium block">Dias Registrados</span>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-2xl font-extrabold text-white">{periodData.count}</span>
              <span className="text-xs text-slate-500">/ {periodDays} dias</span>
            </div>
            <span className="text-[10px] text-slate-500 mt-1 block">Consistência no período</span>
          </div>
        </div>

        {/* Gráfico de Barras de Calorias vs Meta */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-emerald-400" /> Calorias no Período
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {hoveredDay
                  ? `${formatShortDate(hoveredDay.date)}: ${hoveredDay.calories} kcal (P:${hoveredDay.protein}g)`
                  : 'Toque em uma barra para detalhes'}
              </p>
            </div>
            <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-lg border border-emerald-500/20">
              Meta: {t.calories}
            </span>
          </div>

          <div className="relative h-44 pt-4 pb-6 flex items-end gap-1">
            {/* Linha Tracejada da Meta */}
            <div
              className="absolute left-0 right-0 border-t border-dashed border-emerald-400/70 pointer-events-none z-10"
              style={{ bottom: `calc(24px + ${targetLineBottomPct * 0.78}%)` }}
            />

            {periodData.series.map((day, idx) => {
              const heightPct = day.calories > 0 ? Math.max(4, (day.calories / periodData.maxCal) * 100) : 2;
              const isMet =
                profile.goal === 'gain'
                  ? day.calories >= t.calories * 0.9
                  : profile.goal === 'loss'
                  ? day.calories > 0 && day.calories <= t.calories * 1.1
                  : day.calories >= t.calories * 0.9 && day.calories <= t.calories * 1.1;

              const barColor = !day.hasEntries
                ? 'bg-slate-800'
                : isMet
                ? 'bg-emerald-500 hover:bg-emerald-400'
                : 'bg-amber-500/80 hover:bg-amber-400';

              const showLabel =
                periodDays === 7 || idx === 0 || idx === 9 || idx === 19 || idx === periodDays - 1;

              return (
                <div
                  key={day.date}
                  className="flex-1 h-full flex flex-col justify-end items-center relative group cursor-pointer"
                  onClick={() => setHoveredDay(day)}
                >
                  <div className="w-full flex-1 flex items-end justify-center">
                    <div
                      className={`w-full max-w-[28px] rounded-t-md transition-all duration-500 ${barColor} ${
                        hoveredDay?.date === day.date ? 'ring-2 ring-white/60' : ''
                      }`}
                      style={{ height: `${heightPct}%` }}
                    />
                  </div>
                  <span className="text-[9px] text-slate-500 mt-1.5 h-3 leading-none">
                    {showLabel ? formatShortDate(day.date) : ''}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Médias de Macros do Período */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-3">
          <h3 className="text-sm font-bold text-white">Médias de Macronutrientes</h3>
          {[
            { label: 'Proteína', avg: periodData.avgProtein, target: t.protein, color: 'bg-blue-500' },
            { label: 'Carboidrato', avg: periodData.avgCarbs, target: t.carbs, color: 'bg-amber-500' },
            { label: 'Gordura', avg: periodData.avgFats, target: t.fats, color: 'bg-rose-500' }
          ].map((m) => (
            <div key={m.label}>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-300 font-medium">{m.label}</span>
                <span className="text-slate-400">
                  <strong className="text-white">{m.avg}g</strong> / {m.target}g
                </span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                <div
                  className={`${m.color} h-full rounded-full transition-all duration-700`}
                  style={{ width: `${Math.min(100, (m.avg / Math.max(1, m.target)) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Lista Cronológica dos Dias Registrados */}
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-white px-1">
            Registros do Período ({periodData.loggedDaysDesc.length})
          </h3>

          {periodData.loggedDaysDesc.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center">
              <Calendar className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <p className="text-sm text-slate-400">Nenhum dia registrado neste período.</p>
              <p className="text-xs text-slate-500 mt-1">
                Adicione refeições na aba "Hoje" para acompanhar seu histórico.
              </p>
            </div>
          ) : (
            periodData.loggedDaysDesc.map((day) => (
              <button
                key={day.date}
                onClick={() => {
                  setDateString(day.date);
                  setActiveTab('today');
                }}
                className="w-full text-left bg-slate-900 hover:bg-slate-800/80 border border-slate-800 rounded-2xl p-4 flex items-center justify-between transition group"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white">{formatShortDate(day.date)}</span>
                    <span className="text-[11px] text-slate-400 capitalize">
                      {formatFullDatePT(day.date).split(',')[0]}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    P: <span className="text-blue-400 font-medium">{day.protein}g</span> • C:{' '}
                    <span className="text-amber-400 font-medium">{day.carbs}g</span> • G:{' '}
                    <span className="text-rose-400 font-medium">{day.fats}g</span>
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className="text-base font-extrabold text-white block">{day.calories}</span>
                    <span className="text-[10px] text-slate-500 uppercase">kcal</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-emerald-400 transition" />
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    );
  };

  // ==========================================
  // ABA 3: EVOLUÇÃO CORPORAL
  // ==========================================
  const EvolutionView = () => {
    const [isEditingGoal, setIsEditingGoal] = useState(false);
    const [goalInput, setGoalInput] = useState(String(profile.targetWeight || 75));
    const [newWeight, setNewWeight] = useState(String(profile.weight || ''));
    const [weightDate, setWeightDate] = useState(getLocalDateString());
    const [selectedPoint, setSelectedPoint] = useState(null);

    const currentWeight =
      weightLogs.length > 0 ? weightLogs[weightLogs.length - 1].weight : Number(profile.weight || 0);
    const targetWeight = Number(profile.targetWeight || 75);
    const diffToGoal = targetWeight - currentWeight;

    // Cálculo de Ritmo Semanal (Pace)
    const paceInfo = useMemo(() => {
      if (weightLogs.length < 2) {
        return {
          paceLabel: '-- kg/sem',
          statusText: 'Registre pelo menos 2 pesagens para calcular o ritmo semanal.',
          colorClass: 'text-slate-400 bg-slate-800/70 border-slate-700'
        };
      }
      const first = weightLogs[0];
      const last = weightLogs[weightLogs.length - 1];
      const d1 = new Date(first.date + 'T12:00:00');
      const d2 = new Date(last.date + 'T12:00:00');
      const daysDiff = Math.max(1, (d2 - d1) / (1000 * 60 * 60 * 24));
      const weeks = daysDiff / 7;
      const weeklyRate = (last.weight - first.weight) / Math.max(weeks, 0.25);
      const formatted = `${weeklyRate >= 0 ? '+' : ''}${weeklyRate.toFixed(2)} kg/sem`;

      if (profile.goal === 'gain') {
        if (weeklyRate >= 0.2 && weeklyRate <= 0.5) {
          return {
            paceLabel: formatted,
            statusText: 'Ritmo ideal para ganho de massa magra!',
            colorClass: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30'
          };
        }
        if (weeklyRate > 0.5) {
          return {
            paceLabel: formatted,
            statusText: 'Ganho acelerado — monitore o acúmulo de gordura.',
            colorClass: 'text-amber-300 bg-amber-500/10 border-amber-500/30'
          };
        }
        if (weeklyRate > 0) {
          return {
            paceLabel: formatted,
            statusText: 'Evolução lenta — considere +150 kcal diárias.',
            colorClass: 'text-amber-300 bg-amber-500/10 border-amber-500/30'
          };
        }
        return {
          paceLabel: formatted,
          statusText: 'Peso estagnado ou em queda — aumente o superávit.',
          colorClass: 'text-rose-300 bg-rose-500/10 border-rose-500/30'
        };
      }

      return {
        paceLabel: formatted,
        statusText: `Variação média baseada em ${weightLogs.length} registros.`,
        colorClass: 'text-slate-200 bg-slate-800/80 border-slate-700'
      };
    }, [weightLogs, profile.goal]);

    // Preparação do Gráfico SVG
    const chartData = useMemo(() => {
      const paddingX = 12;
      const paddingY = 14;
      const width = 320;
      const height = 160;

      const allVals = [...weightLogs.map((w) => w.weight), targetWeight];
      const rawMin = Math.min(...allVals);
      const rawMax = Math.max(...allVals);
      const margin = Math.max(1.5, (rawMax - rawMin) * 0.2);
      const minW = Math.floor((rawMin - margin) * 2) / 2;
      const maxW = Math.ceil((rawMax + margin) * 2) / 2;
      const range = Math.max(1, maxW - minW);

      const mapY = (val) =>
        height - paddingY - ((val - minW) / range) * (height - paddingY * 2);

      const pts = weightLogs.map((entry, idx) => {
        const x =
          weightLogs.length > 1
            ? paddingX + (idx / (weightLogs.length - 1)) * (width - paddingX * 2)
            : width / 2;
        const y = mapY(entry.weight);
        return { ...entry, x, y };
      });

      const polylineStr = pts.map((p) => `${p.x},${p.y}`).join(' ');
      const areaStr =
        pts.length > 1
          ? `${pts[0].x},${height - paddingY} ${polylineStr} ${pts[pts.length - 1].x},${height - paddingY}`
          : '';

      return {
        width,
        height,
        minW,
        maxW,
        targetY: mapY(targetWeight),
        pts,
        polylineStr,
        areaStr
      };
    }, [weightLogs, targetWeight]);

    const handleGoalSave = async (e) => {
      e.preventDefault();
      await updateTargetWeight(goalInput);
      setIsEditingGoal(false);
    };

    const handleNewWeightSubmit = async (e) => {
      e.preventDefault();
      await saveWeightLog(newWeight, weightDate);
    };

    const reversedLogs = [...weightLogs].reverse();

    return (
      <div className="space-y-6">
        {/* Card Interativo de Meta de Peso */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 relative overflow-hidden">
          <div className="absolute -right-8 -top-8 w-28 h-28 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Target className="w-5 h-5 text-emerald-400" /> Meta de Peso
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {Math.abs(diffToGoal) < 0.1
                  ? 'Meta atingida! Parabéns!'
                  : diffToGoal > 0
                  ? `Faltam +${diffToGoal.toFixed(1)} kg para atingir a meta`
                  : `Faltam ${diffToGoal.toFixed(1)} kg para atingir a meta`}
              </p>
            </div>
            <button
              onClick={() => {
                setGoalInput(String(targetWeight));
                setIsEditingGoal(!isEditingGoal);
              }}
              className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 transition flex items-center gap-1"
            >
              <Edit3 className="w-3.5 h-3.5" /> {isEditingGoal ? 'Fechar' : 'Editar Meta'}
            </button>
          </div>

          {isEditingGoal ? (
            <form onSubmit={handleGoalSave} className="flex items-center gap-2 mb-4 bg-slate-950 p-3 rounded-2xl border border-emerald-500/40">
              <input
                type="number"
                step="0.1"
                required
                value={goalInput}
                onChange={(e) => setGoalInput(e.target.value)}
                className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-bold text-base focus:outline-none focus:border-emerald-500"
              />
              <span className="text-xs text-slate-400 font-bold">kg</span>
              <button
                type="submit"
                className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs px-4 py-2.5 rounded-xl transition"
              >
                Salvar
              </button>
            </form>
          ) : (
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-3.5">
                <span className="text-[10px] uppercase tracking-wider text-slate-500 block">Peso Atual</span>
                <div className="mt-1 flex items-baseline gap-1">
                  <span className="text-3xl font-extrabold text-white">{currentWeight.toFixed(1)}</span>
                  <span className="text-xs text-slate-400">kg</span>
                </div>
              </div>
              <div className="bg-slate-950/70 border border-emerald-500/20 rounded-2xl p-3.5">
                <span className="text-[10px] uppercase tracking-wider text-emerald-400 block">Meta Atribuída</span>
                <div className="mt-1 flex items-baseline gap-1">
                  <span className="text-3xl font-extrabold text-emerald-400">{targetWeight.toFixed(1)}</span>
                  <span className="text-xs text-emerald-400/70">kg</span>
                </div>
              </div>
            </div>
          )}

          {/* Indicador de Ritmo (Pace Semanal) */}
          <div className={`p-3 rounded-2xl border text-xs flex items-center justify-between gap-3 ${paceInfo.colorClass}`}>
            <div className="flex items-center gap-2 min-w-0">
              <Award className="w-4 h-4 shrink-0" />
              <span className="truncate">{paceInfo.statusText}</span>
            </div>
            <span className="font-extrabold shrink-0">{paceInfo.paceLabel}</span>
          </div>
        </div>

        {/* Gráfico de Evolução em SVG */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Scale className="w-4 h-4 text-emerald-400" /> Curva de Evolução
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {selectedPoint
                  ? `${formatShortDate(selectedPoint.date)}: ${selectedPoint.weight.toFixed(1)} kg`
                  : 'Toque nos pontos para inspecionar'}
              </p>
            </div>
            <span className="text-[10px] text-slate-400">
              {chartData.minW.toFixed(1)} – {chartData.maxW.toFixed(1)} kg
            </span>
          </div>

          {weightLogs.length === 0 ? (
            <div className="h-36 flex items-center justify-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-2xl">
              Registre sua primeira pesagem abaixo para gerar o gráfico.
            </div>
          ) : (
            <div className="w-full overflow-hidden">
              <svg
                viewBox={`0 0 ${chartData.width} ${chartData.height}`}
                className="w-full h-44 overflow-visible"
              >
                <defs>
                  <linearGradient id="weightAreaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity="0.32" />
                    <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Linha horizontal tracejada da Meta */}
                <line
                  x1="0"
                  y1={chartData.targetY}
                  x2={chartData.width}
                  y2={chartData.targetY}
                  stroke="#34d399"
                  strokeWidth="1.2"
                  strokeDasharray="5 4"
                  opacity="0.75"
                />
                <text
                  x={chartData.width - 4}
                  y={Math.max(12, chartData.targetY - 5)}
                  textAnchor="end"
                  fill="#34d399"
                  fontSize="9"
                  fontWeight="bold"
                >
                  Meta: {targetWeight.toFixed(1)} kg
                </text>

                {/* Área preenchida sob a curva */}
                {chartData.areaStr && (
                  <polygon points={chartData.areaStr} fill="url(#weightAreaGrad)" />
                )}

                {/* Linha da evolução */}
                {chartData.pts.length > 1 && (
                  <polyline
                    points={chartData.polylineStr}
                    fill="none"
                    stroke="#10b981"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}

                {/* Pontos clicáveis */}
                {chartData.pts.map((pt, idx) => {
                  const isSelected = selectedPoint?.date === pt.date;
                  const showEdgeText =
                    chartData.pts.length <= 6 ||
                    idx === 0 ||
                    idx === chartData.pts.length - 1 ||
                    isSelected;
                  return (
                    <g
                      key={pt.date}
                      onClick={() => setSelectedPoint(pt)}
                      className="cursor-pointer"
                    >
                      <circle
                        cx={pt.x}
                        cy={pt.y}
                        r={isSelected ? 6 : 4}
                        fill={isSelected ? '#ffffff' : '#10b981'}
                        stroke="#020617"
                        strokeWidth="2"
                      />
                      {showEdgeText && (
                        <>
                          <text
                            x={pt.x}
                            y={pt.y - 9}
                            textAnchor="middle"
                            fill="#e2e8f0"
                            fontSize="8.5"
                            fontWeight="bold"
                          >
                            {pt.weight.toFixed(1)}
                          </text>
                          <text
                            x={pt.x}
                            y={chartData.height - 1}
                            textAnchor="middle"
                            fill="#64748b"
                            fontSize="8"
                          >
                            {formatShortDate(pt.date)}
                          </text>
                        </>
                      )}
                    </g>
                  );
                })}
              </svg>
            </div>
          )}
        </div>

        {/* Formulário Rápido de Nova Pesagem */}
        <form
          onSubmit={handleNewWeightSubmit}
          className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-3"
        >
          <h3 className="text-sm font-bold text-white">Registrar Nova Pesagem</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] text-slate-400 block mb-1 ml-1">Peso (kg)</label>
              <input
                type="number"
                step="0.1"
                required
                value={newWeight}
                onChange={(e) => setNewWeight(e.target.value)}
                placeholder="Ex: 68.5"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white font-bold text-sm focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-400 block mb-1 ml-1">Data</label>
              <input
                type="date"
                required
                max={getLocalDateString()}
                value={weightDate}
                onChange={(e) => setWeightDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>
          <button
            type="submit"
            className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-3 rounded-xl transition text-sm"
          >
            Salvar Pesagem
          </button>
        </form>

        {/* Histórico de Pesagens */}
        <div className="space-y-2.5">
          <h3 className="text-sm font-bold text-white px-1">
            Histórico de Pesagens ({reversedLogs.length})
          </h3>
          {reversedLogs.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-4">Nenhuma pesagem registrada.</p>
          ) : (
            reversedLogs.map((entry, idx) => {
              const prevEntry = reversedLogs[idx + 1];
              const delta = prevEntry ? entry.weight - prevEntry.weight : null;
              return (
                <div
                  key={entry.date}
                  className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 flex items-center justify-between"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-base font-extrabold text-white">
                        {entry.weight.toFixed(1)} kg
                      </span>
                      {delta !== null && (
                        <span
                          className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                            delta > 0
                              ? 'bg-emerald-500/15 text-emerald-400'
                              : delta < 0
                              ? 'bg-rose-500/15 text-rose-400'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {delta > 0 ? `+${delta.toFixed(1)}` : delta.toFixed(1)} kg
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-slate-400 capitalize">
                      {formatShortDate(entry.date)} • {formatFullDatePT(entry.date).split(',')[0]}
                    </span>
                  </div>
                  <button
                    onClick={() => deleteWeightLog(entry.date)}
                    className="p-2 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition"
                    title="Excluir registro"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  };

  // ==========================================
  // CONTAINER DO DASHBOARD COM NAVEGAÇÃO INFERIOR
  // ==========================================
  const DashboardScreen = () => {
    if (!profile) return null;

    const headerTitle =
      activeTab === 'today' ? 'NutriFit AI' : activeTab === 'history' ? 'Histórico' : 'Evolução Corporal';

    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col relative pb-28">
        {/* Cabeçalho Fixo */}
        <header className="sticky top-0 z-20 bg-slate-950/85 backdrop-blur-lg border-b border-slate-800 px-5 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-extrabold leading-tight">{headerTitle}</h1>
              <p className="text-[11px] text-slate-400">
                Meta: <span className="text-emerald-400 font-semibold">{profile.targetWeight || 75} kg</span>
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setShowProfileModal(true)}
              className="w-10 h-10 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-emerald-400 hover:bg-emerald-500/10 hover:border-emerald-500/40 transition"
              title="Editar Perfil e Metas"
            >
              <SlidersHorizontal className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowSettingsModal(true)}
              className="w-10 h-10 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 hover:text-white transition"
              title="Configurações"
            >
              <Settings className="w-5 h-5" />
            </button>
            <button
              onClick={() => signOut(auth)}
              className="w-10 h-10 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-rose-400 hover:bg-rose-500/10 transition"
              title="Sair"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Conteúdo da Aba Ativa */}
        <main className="p-4 max-w-md mx-auto w-full flex-1">
          {activeTab === 'today' && <TodayView />}
          {activeTab === 'history' && <HistoryView />}
          {activeTab === 'evolution' && <EvolutionView />}
        </main>

        {/* Botão Flutuante (visível apenas na aba Hoje) */}
        {activeTab === 'today' && (
          <button
            onClick={() => {
              setSelectedMealSection('Almoço');
              setShowMealModal(true);
            }}
            className="fixed bottom-24 right-5 w-14 h-14 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-full shadow-[0_4px_24px_rgba(16,185,129,0.5)] flex items-center justify-center hover:scale-105 transition-transform z-20"
            title="Adicionar refeição"
          >
            <Plus className="w-6 h-6" />
          </button>
        )}

        {/* Barra de Navegação Inferior Fixa */}
        <nav className="fixed bottom-0 left-0 right-0 z-30 bg-slate-950/95 backdrop-blur-lg border-t border-slate-800">
          <div className="max-w-md mx-auto grid grid-cols-3 px-2 py-2">
            {[
              { id: 'today', label: 'Hoje', Icon: Utensils },
              { id: 'history', label: 'Histórico', Icon: BarChart3 },
              { id: 'evolution', label: 'Evolução', Icon: Scale }
            ].map(({ id, label, Icon }) => {
              const isActive = activeTab === id;
              return (
                <button
                  key={id}
                  onClick={() => setActiveTab(id)}
                  className={`flex flex-col items-center justify-center py-2 rounded-2xl transition ${
                    isActive ? 'text-emerald-400 bg-emerald-500/10' : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  <Icon className="w-5 h-5 mb-1" />
                  <span className="text-[11px] font-bold">{label}</span>
                </button>
              );
            })}
          </div>
        </nav>
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
      <ProfileEditModal />

      {currentScreen === 'auth' && <AuthScreen />}
      {currentScreen === 'setup' && <OnboardingScreen />}
      {currentScreen === 'dashboard' && <DashboardScreen />}
    </div>
  );
}