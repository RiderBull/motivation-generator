import { login, signup } from './actions'
import { KeyRound, Mail, ArrowRight, Sparkles } from 'lucide-react'

export default function LoginPage() {
    return (
        <div className="flex min-h-screen w-full items-center justify-center bg-zinc-950 p-4 font-sans text-zinc-100">
            <div className="absolute inset-0 overflow-hidden">
                <div className="absolute -left-[10%] -top-[10%] h-[500px] w-[500px] rounded-full bg-indigo-500/10 blur-[100px]" />
                <div className="absolute -right-[10%] -bottom-[10%] h-[500px] w-[500px] rounded-full bg-purple-500/10 blur-[100px]" />
            </div>

            <div className="relative w-full max-w-md space-y-8 rounded-2xl border border-white/5 bg-white/5 p-8 backdrop-blur-2xl transition-all duration-300 hover:border-white/10 hover:bg-white/10 hover:shadow-2xl hover:shadow-indigo-500/10">
                <div className="text-center space-y-2">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/20">
                        <Sparkles className="h-7 w-7 text-white" />
                    </div>
                    <h1 className="text-3xl font-bold tracking-tight text-white">Welcome Back</h1>
                    <p className="text-sm text-zinc-400">
                        Sign in to your account to continue
                    </p>
                </div>

                <form className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-xs font-medium uppercase tracking-wider text-zinc-500 ml-1">
                            Email
                        </label>
                        <div className="relative group">
                            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-indigo-400 transition-colors">
                                <Mail className="h-5 w-5" />
                            </div>
                            <input
                                id="email"
                                name="email"
                                type="email"
                                required
                                placeholder="you@example.com"
                                className="w-full rounded-xl border border-white/10 bg-black/20 p-3 pl-10 text-white placeholder-zinc-500 outline-none transition-all focus:border-indigo-500/50 focus:bg-black/40 focus:ring-1 focus:ring-indigo-500/50"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-medium uppercase tracking-wider text-zinc-500 ml-1">
                            Password
                        </label>
                        <div className="relative group">
                            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-indigo-400 transition-colors">
                                <KeyRound className="h-5 w-5" />
                            </div>
                            <input
                                id="password"
                                name="password"
                                type="password"
                                required
                                placeholder="••••••••"
                                className="w-full rounded-xl border border-white/10 bg-black/20 p-3 pl-10 text-white placeholder-zinc-500 outline-none transition-all focus:border-indigo-500/50 focus:bg-black/40 focus:ring-1 focus:ring-indigo-500/50"
                            />
                        </div>
                    </div>

                    <div className="space-y-4 pt-2">
                        <button
                            formAction={login}
                            className="group relative w-full overflow-hidden rounded-xl bg-white p-3 text-sm font-bold text-black transition-all hover:bg-zinc-200 active:scale-95"
                        >
                            <div className="flex items-center justify-center gap-2">
                                <span>Sign In</span>
                                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                            </div>
                        </button>
                        <button
                            formAction={signup}
                            className="w-full rounded-xl border border-white/10 bg-transparent p-3 text-sm font-bold text-white transition-all hover:bg-white/5 active:scale-95"
                        >
                            Create Account
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
