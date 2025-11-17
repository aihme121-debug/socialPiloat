'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Check, X, Star, ArrowRight, Zap, Users, BarChart3, MessageSquare, Calendar, TrendingUp } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface PricingPlan {
  id: string
  name: string
  price: number
  originalPrice?: number
  currency: string
  interval: string
  description: string
  features: string[]
  limitations: string[]
  badge?: string
  popular?: boolean
  cta: string
  ctaAction: () => void
}

interface Feature {
  icon: React.ReactNode
  title: string
  description: string
}

const features: Feature[] = [
  {
    icon: <Zap className="h-6 w-6" />,
    title: "AI-Powered Content Creation",
    description: "Generate engaging posts with advanced AI that understands your brand voice and audience preferences."
  },
  {
    icon: <Calendar className="h-6 w-6" />,
    title: "Smart Scheduling",
    description: "Automatically schedule posts at optimal times when your audience is most active and engaged."
  },
  {
    icon: <BarChart3 className="h-6 w-6" />,
    title: "Advanced Analytics",
    description: "Track performance across all platforms with detailed insights and actionable recommendations."
  },
  {
    icon: <MessageSquare className="h-6 w-6" />,
    title: "Unified Inbox",
    description: "Manage all your social media conversations from one centralized dashboard with smart filtering."
  },
  {
    icon: <Users className="h-6 w-6" />,
    title: "Team Collaboration",
    description: "Work seamlessly with your team using role-based permissions and approval workflows."
  },
  {
    icon: <TrendingUp className="h-6 w-6" />,
    title: "Growth Tools",
    description: "Automated engagement tools and growth strategies to expand your social media presence."
  }
]

export default function Home() {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly')
  const [hoveredPlan, setHoveredPlan] = useState<string | null>(null)

  const pricingPlans: PricingPlan[] = [
    {
      id: 'starter',
      name: 'Starter',
      price: billingCycle === 'monthly' ? 29 : 290,
      originalPrice: billingCycle === 'monthly' ? 39 : 390,
      currency: '$',
      interval: billingCycle === 'monthly' ? 'month' : 'year',
      description: 'Perfect for individuals and small businesses',
      features: [
        'Up to 3 social accounts',
        '50 AI-generated posts per month',
        'Basic analytics dashboard',
        'Content calendar',
        'Mobile app access',
        'Email support'
      ],
      limitations: [
        'No team collaboration',
        'Limited automation rules',
        'No advanced reporting',
        'No API access'
      ],
      cta: 'Start Free Trial',
      ctaAction: () => console.log('Starter plan selected')
    },
    {
      id: 'professional',
      name: 'Professional',
      price: billingCycle === 'monthly' ? 79 : 790,
      originalPrice: billingCycle === 'monthly' ? 99 : 990,
      currency: '$',
      interval: billingCycle === 'monthly' ? 'month' : 'year',
      description: 'Ideal for growing businesses and agencies',
      badge: 'Most Popular',
      popular: true,
      features: [
        'Up to 10 social accounts',
        'Unlimited AI-generated posts',
        'Advanced analytics & reporting',
        'Team collaboration (5 users)',
        'Automation rules',
        'Content approval workflows',
        'Priority support',
        'API access (10k calls/month)'
      ],
      limitations: [
        'Limited white-label options',
        'No custom integrations'
      ],
      cta: 'Start Free Trial',
      ctaAction: () => console.log('Professional plan selected')
    },
    {
      id: 'enterprise',
      name: 'Enterprise',
      price: billingCycle === 'monthly' ? 199 : 1990,
      originalPrice: billingCycle === 'monthly' ? 249 : 2490,
      currency: '$',
      interval: billingCycle === 'monthly' ? 'month' : 'year',
      description: 'For large organizations with advanced needs',
      badge: 'Best Value',
      features: [
        'Unlimited social accounts',
        'Unlimited AI-generated posts',
        'Custom analytics dashboards',
        'Advanced team management',
        'White-label solutions',
        'Custom integrations',
        'Dedicated account manager',
        '24/7 premium support',
        'API access (unlimited)',
        'Custom training & onboarding'
      ],
      limitations: [],
      cta: 'Contact Sales',
      ctaAction: () => console.log('Enterprise plan selected')
    }
  ]

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  }

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        type: "spring" as const,
        stiffness: 100
      }
    }
  }

  const planCardVariants = {
    hidden: { scale: 0.9, opacity: 0 },
    visible: {
      scale: 1,
      opacity: 1,
      transition: {
        type: "spring" as const,
        stiffness: 200,
        damping: 20
      }
    },
    hover: {
      scale: 1.05,
      transition: {
        type: "spring" as const,
        stiffness: 400,
        damping: 10
      }
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="container mx-auto px-4 py-20">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center mb-16"
          >
            <h1 className="text-5xl md:text-7xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent mb-6">
              SocialPiloat.Ai
            </h1>
            <p className="text-xl md:text-2xl text-gray-600 dark:text-gray-300 mb-8 max-w-3xl mx-auto">
              Revolutionize your social media management with AI-powered content creation, 
              smart scheduling, and advanced analytics across all platforms
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" className="text-lg px-8 py-6">
                Start Free Trial
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button size="lg" variant="outline" className="text-lg px-8 py-6">
                Watch Demo
              </Button>
            </div>
          </motion.div>

          {/* Features Grid */}
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mb-20"
          >
            {features.map((feature, index) => (
              <motion.div
                key={index}
                variants={itemVariants}
                className="bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm p-6 rounded-2xl border border-white/20 dark:border-slate-700/50 hover:shadow-xl transition-all duration-300"
              >
                <div className="text-blue-600 dark:text-blue-400 mb-4">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                <p className="text-gray-600 dark:text-gray-300">{feature.description}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="text-center mb-12"
          >
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              Choose Your Perfect Plan
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300 mb-8">
              Start free, upgrade when you need. No hidden fees.
            </p>
            
            {/* Billing Toggle */}
            <div className="flex items-center justify-center gap-4 mb-12">
              <span className={`text-lg ${billingCycle === 'monthly' ? 'text-gray-900 dark:text-white font-semibold' : 'text-gray-500'}`}>
                Monthly
              </span>
              <button
                onClick={() => setBillingCycle(billingCycle === 'monthly' ? 'yearly' : 'monthly')}
                className={`relative inline-flex h-8 w-16 items-center rounded-full transition-colors ${
                  billingCycle === 'yearly' ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
                }`}
              >
                <span
                  className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                    billingCycle === 'yearly' ? 'translate-x-9' : 'translate-x-1'
                  }`}
                />
              </button>
              <span className={`text-lg ${billingCycle === 'yearly' ? 'text-gray-900 dark:text-white font-semibold' : 'text-gray-500'}`}>
                Yearly
              </span>
              <Badge variant="secondary" className="ml-2">
                Save 20%
              </Badge>
            </div>
          </motion.div>

          {/* Pricing Cards */}
          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="grid lg:grid-cols-3 gap-8 max-w-7xl mx-auto"
          >
            {pricingPlans.map((plan, index) => (
              <motion.div
                key={plan.id}
                variants={planCardVariants}
                whileHover="hover"
                onHoverStart={() => setHoveredPlan(plan.id)}
                onHoverEnd={() => setHoveredPlan(null)}
                className={`relative ${plan.popular ? 'lg:scale-110' : ''}`}
              >
                <Card className={`h-full transition-all duration-300 ${
                  plan.popular 
                    ? 'border-blue-500 shadow-2xl shadow-blue-500/20' 
                    : 'border-gray-200 dark:border-gray-700 hover:shadow-xl'
                } ${hoveredPlan && hoveredPlan !== plan.id ? 'opacity-75' : ''}`}>
                  {plan.badge && (
                    <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                      <Badge className={`${
                        plan.popular 
                          ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white' 
                          : 'bg-gradient-to-r from-green-600 to-emerald-600 text-white'
                      } px-4 py-1`}>
                        {plan.badge}
                      </Badge>
                    </div>
                  )}
                  
                  <CardHeader className="text-center pb-8">
                    <CardTitle className="text-2xl mb-2">{plan.name}</CardTitle>
                    <CardDescription className="text-base">{plan.description}</CardDescription>
                    
                    <div className="mt-6">
                        <div className="flex items-baseline justify-center">
                          <span className="text-4xl font-bold">{plan.currency}</span>
                          <motion.span 
                            className="text-6xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent"
                            key={plan.price}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, ease: "easeOut" }}
                          >
                            {plan.price}
                          </motion.span>
                        </div>
                        <p className="text-gray-500 dark:text-gray-400 mt-2">per {plan.interval}</p>
                        {plan.originalPrice && (
                          <p className="text-sm text-gray-400 line-through mt-1">
                            {plan.currency}{plan.originalPrice} originally
                          </p>
                        )}
                      </div>
                  </CardHeader>

                  <CardContent className="space-y-6">
                    <div>
                      <h4 className="font-semibold mb-3 text-green-600 dark:text-green-400">
                        ✓ What's Included
                      </h4>
                      <ul className="space-y-2">
                        {plan.features.map((feature, featureIndex) => (
                          <motion.li
                            key={featureIndex}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.1 + featureIndex * 0.05 }}
                            className="flex items-start gap-3"
                          >
                            <Check className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                            <span className="text-sm text-gray-600 dark:text-gray-300">{feature}</span>
                          </motion.li>
                        ))}
                      </ul>
                    </div>

                    {plan.limitations.length > 0 && (
                      <div>
                        <h4 className="font-semibold mb-3 text-red-600 dark:text-red-400">
                          ✗ Limitations
                        </h4>
                        <ul className="space-y-2">
                          {plan.limitations.map((limitation, limitationIndex) => (
                            <motion.li
                              key={limitationIndex}
                              initial={{ opacity: 0, x: -20 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: index * 0.1 + limitationIndex * 0.05 + 0.2 }}
                              className="flex items-start gap-3"
                            >
                              <X className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
                              <span className="text-sm text-gray-500 dark:text-gray-400">{limitation}</span>
                            </motion.li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <Button 
                      className={`w-full mt-6 ${
                        plan.popular 
                          ? 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700' 
                          : ''
                      }`}
                      variant={plan.popular ? 'default' : 'outline'}
                      size="lg"
                      onClick={plan.ctaAction}
                    >
                      {plan.cta}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>

          {/* Comparison Table */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="mt-20"
          >
            <h3 className="text-2xl font-bold text-center mb-8">Feature Comparison</h3>
            <div className="overflow-x-auto">
              <table className="w-full bg-white dark:bg-slate-800 rounded-2xl shadow-lg">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left p-4 font-semibold">Features</th>
                    <th className="text-center p-4 font-semibold">Starter</th>
                    <th className="text-center p-4 font-semibold bg-blue-50 dark:bg-blue-900/20">Professional</th>
                    <th className="text-center p-4 font-semibold">Enterprise</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    'Social Accounts',
                    'AI Posts per Month',
                    'Team Members',
                    'Analytics',
                    'Automation Rules',
                    'API Access',
                    'Support'
                  ].map((feature, index) => (
                    <tr key={index} className="border-b border-gray-100 dark:border-gray-800">
                      <td className="p-4 font-medium">{feature}</td>
                      <td className="text-center p-4">3 / 50 / 1 / Basic / 5 / None / Email</td>
                      <td className="text-center p-4 bg-blue-50 dark:bg-blue-900/20">10 / Unlimited / 5 / Advanced / Unlimited / 10k / Priority</td>
                      <td className="text-center p-4">Unlimited / Unlimited / Unlimited / Custom / Unlimited / Unlimited / 24/7 Premium</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-blue-600 to-purple-600">
        <div className="container mx-auto px-4 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          >
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
              Ready to Transform Your Social Media?
            </h2>
            <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
              Join thousands of businesses already using SocialPiloat.Ai to streamline their social media management and drive real results.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" variant="secondary" className="text-lg px-8 py-6">
                Start Your Free 14-Day Trial
              </Button>
              <Button size="lg" variant="outline" className="text-lg px-8 py-6 bg-white/10 border-white/30 text-white hover:bg-white/20">
                Schedule Demo
              </Button>
            </div>
            <p className="text-blue-100 mt-4 text-sm">
              ✓ No credit card required ✓ Cancel anytime ✓ 30-day money-back guarantee
            </p>
          </motion.div>
        </div>
      </section>
    </div>
  )
}