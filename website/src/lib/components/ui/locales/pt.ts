import type en from './en';

export default {
	lang: {
		code: 'pt',
		name: 'Português',
		flagCode: 'br'
	},
	global: {
		price: 'Preço',
		name: 'Nome',
		reset: 'Resetar',
		apply: 'Aplicar',
		coin: 'Moeda',
		max: 'Máx.',
		cancel: 'Cancelar',
		try_again: 'Tente Novamente',
		type: 'Tipo',
		sender: 'Remetente',
		receiver: 'Destinatário',
		unknown: 'Desconhecido',
		quantity: 'Quantidade',
		amount: 'Quantia',
		date: 'Data',
		note: 'Anotação',
		value: 'Valor'
	},
	greetings: {
		good_morning: 'Bom Dia, {{name}}!',
		good_afternoon: 'Boa Tarde, {{name}}!',
		good_evening: 'Boa Noite, {{name}}!',
		good_night: 'Boa Noite, {{name}}!'
	},
	page_names: {
		home: 'Início',
		market: 'Mercado',
		hopium: 'Hopium',
		arcade: 'Arcade',
		leaderboard: 'Placar de Líderes',
		shop: 'Loja',
		achievements: 'Conquistas',
		portfolio: 'Portfólio',
		treemap: 'Treemap',
		create_coin: 'Criar Moeda',
		notifications: 'Notificações',
		about: 'Sobre',
		live_trades: 'Negociações ao vivo'
	},
	main: {
		title: 'Bem vindo(a) ao XprismPlay!',
		description: 'Aqui está um panorama do mercado para hoje.',
		market_overview: 'Visão Geral do Mercado'
	},
	coin: {
		'24hchange': 'Mudança em 24h',
		marketcap: 'Capitalização de Mercado',
		volume24h: 'Volume (24h)'
	},
	sign_in: {
		message: ['Você precisa', 'fazer login', 'para jogar.'],
		form: {
			title: 'Faça login em XprismPlay',
			description:
				'Escolha um serviço para logar com. Sua conta será criada imediatamente se não tiver uma.',
			services: {
				google: 'Continuar com Google'
			},
			terms: [
				'Ao continuar, você concorda com nossos',
				'Termos de Serviço',
				'e',
				'Políticas de Privacidade'
			]
		},
		portfolio: ['Você precisa estar logado para ver seu portfólio', 'Fazer Login']
	},
	leaderboard: {
		title: 'Placar de Líderes',
		description: 'Maiores desempenhos e atividade de mercado',
		no_data: 'Sem Dados',
		failed: {
			title: 'Ocorreu um erro ao carregar o Placar de Líderes',
			try_again: 'Tentar Novamente'
		},
		rugpullers: {
			title: 'Maiores Rugpullers (24h)',
			description: 'Usuários que mais lucraram vendendo moedas hoje',
			no_data: 'Nenhum lucro significativo registrado hoje'
		},
		losers: {
			title: 'Maiores Perdas (24h)',
			description: 'Usuários que mais perderam dinheiro hoje',
			no_data: 'Nenhuma perda significativa registrada hoje'
		},
		top_cash: {
			title: 'Maiores Detentores de Dinheiro',
			description: 'Usuários com maior saldo de dinheiro líquido',
			no_data: 'Todos Investiram! 💸'
		},
		portfolio: {
			title: 'Maiores Valores de Portfólios',
			description: 'Usuários com os maiores valores de portfólio (incluindo não líquido)',
			no_data: 'Ainda sem grandes portfólios! 📉'
		}
	},
	market: {
		title: 'Mercado',
		description: 'Descubra Moedas, Acompanhe seu desempenho, e encontre seu próximo investimento',
		showing: 'Mostrando {{startIndex}}-{{endIndex}} de {{totalCount}} moedas',
		search: {
			placeholder: 'Pesquisar moedas pelo nome ou símbolo...',
			filters: {
				title: 'Filtros',
				sort_by: 'Sortear por',
				change24h: 'Mudança (24h)',
				price: 'Preço',
				marketcap: 'Capitalização',
				volume24h: 'Volume (24h)',
				clear: 'Limpar todos os filtros',
				sort_order: {
					title: 'Ordem de Sorteio',
					high_low: 'Alto para Baixo',
					low_high: 'Baixo para Alto'
				},
				price_range: {
					title: 'Faixa de Preço',
					all_prices: 'Todos os Preços',
					under1: 'Menos de $1',
					'1-10': '$1 - $10',
					'10-100': '$10 - $100',
					over100: 'Acima de $100'
				},
				'24h_change': {
					title: 'Mudança em 24h',
					all: 'Todas as Mudanças',
					gainers: 'Apenas os Ganhadores',
					losers: 'Apenas os Perdedores',
					hot: 'Quente (10%)',
					wild: 'Selvagem (50%)'
				}
			}
		}
	},
	portfolio: {
		title: 'Portfólio',
		description: 'Gerencie seus investimentos e transações',
		cash_balance: ['Saldo em Dinheiro', '{{percent}}% do portfólio'],
		coin_holdings: ['Participações em Moedas', '{{quantity}} posições'],
		your_holdings: ['Suas Ações', 'As ações em seu portfólio'],
		recent_transactions: ['Transações Recentes', 'Suas últimas atividades de troca', 'Ver todas'],
		total: 'Total',
		no_coins: [
			'Sem Participações de Moedas',
			'Você não tem participação de nenhuma moeda ainda. Começe comprando moedas existentes.',
			'Pesquisar Moedas'
		],
		send_money: {
			title: 'Enviar Dinheiro',
			send: ['Enviar', 'Enviando...'],
			description: 'Envie dinheiro ou moedas para outro usuário',
			recipient: ['Destinatário', 'Digite o username (sem o @)'],
			type: ['Tipo', 'Dinheiro ($)', 'Moedas', 'Selecione o tipo de transferência'],
			cash: [
				'Quantidade ($)',
				'Disponível: ${{balance}}',
				'Mínimo: $10.00 por transferência',
				'Transferências de dinheiro precisam ser de pelo menos $10.00',
				'Fundos insuficientes',
				'Dinheiro enviado com sucesso!',
				'Enviado ${{amount}} para @{{recipent}}'
			],
			coins: [
				'Selecione a Moeda',
				'Quantidade {{coinSymbol}}',
				'Disponível: {{shares}}',
				'Valor mínimo estimado: $10.00 por transferência',
				'Transferências de moedas precisam de um valor estimado de pelo menos $10.00',
				'Moedas não suficientes',
				'Moedas enviadas com sucesso!',
				'Enviou {{amount}} {{symbol}} (≈${{estimated}}) para @${{recipent}}'
			],
			note: [
				'Anotação',
				'(Opcional)',
				'Adicione uma nota de referência para essa transferência...'
			],
			youre_sending: ['Você está mandando:', '{{amount}} USD', 'Para:']
		},
		no_transactions: [
			'Sem transações ainda',
			'Você não fez nenhuma troca ainda. Começe comprando ou vendendo moedas.'
		]
	}
} satisfies typeof en;
