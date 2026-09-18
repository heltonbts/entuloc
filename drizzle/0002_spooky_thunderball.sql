CREATE TYPE "public"."forma_pagamento" AS ENUM('dinheiro', 'pix', 'boleto', 'cartao', 'transferencia');--> statement-breakpoint
CREATE TYPE "public"."origem_cobranca" AS ENUM('locacao', 'venda_material');--> statement-breakpoint
CREATE TYPE "public"."unidade_material" AS ENUM('tonelada', 'metro_cubico');--> statement-breakpoint
CREATE TABLE "cobrancas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cliente_id" uuid NOT NULL,
	"origem" "origem_cobranca" NOT NULL,
	"locacao_id" uuid,
	"venda_id" uuid,
	"descricao" text NOT NULL,
	"valor_total" integer NOT NULL,
	"vencimento_em" date NOT NULL,
	"cancelada" boolean DEFAULT false NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cobrancas_valor_positivo" CHECK ("cobrancas"."valor_total" > 0),
	CONSTRAINT "cobrancas_origem_coerente" CHECK (("cobrancas"."origem" = 'locacao' AND "cobrancas"."locacao_id" IS NOT NULL AND "cobrancas"."venda_id" IS NULL)
       OR ("cobrancas"."origem" = 'venda_material' AND "cobrancas"."venda_id" IS NOT NULL AND "cobrancas"."locacao_id" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "materiais" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" text NOT NULL,
	"unidade" "unidade_material" DEFAULT 'tonelada' NOT NULL,
	"preco_unitario" integer NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "materiais_nome_unique" UNIQUE("nome"),
	CONSTRAINT "materiais_preco_nao_negativo" CHECK ("materiais"."preco_unitario" >= 0)
);
--> statement-breakpoint
CREATE TABLE "recebimentos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cobranca_id" uuid NOT NULL,
	"valor" integer NOT NULL,
	"forma" "forma_pagamento" NOT NULL,
	"recebido_em" date NOT NULL,
	"observacoes" text,
	"registrado_por_id" uuid,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "recebimentos_valor_positivo" CHECK ("recebimentos"."valor" > 0)
);
--> statement-breakpoint
CREATE TABLE "vendas_material" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cliente_id" uuid NOT NULL,
	"material_id" uuid NOT NULL,
	"quantidade" numeric(12, 3) NOT NULL,
	"preco_unitario" integer NOT NULL,
	"valor_total" integer NOT NULL,
	"vendida_em" date NOT NULL,
	"registrado_por_id" uuid,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vendas_quantidade_positiva" CHECK ("vendas_material"."quantidade" > 0),
	CONSTRAINT "vendas_valores_nao_negativos" CHECK ("vendas_material"."preco_unitario" >= 0 AND "vendas_material"."valor_total" >= 0)
);
--> statement-breakpoint
ALTER TABLE "cobrancas" ADD CONSTRAINT "cobrancas_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cobrancas" ADD CONSTRAINT "cobrancas_locacao_id_locacoes_id_fk" FOREIGN KEY ("locacao_id") REFERENCES "public"."locacoes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cobrancas" ADD CONSTRAINT "cobrancas_venda_id_vendas_material_id_fk" FOREIGN KEY ("venda_id") REFERENCES "public"."vendas_material"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recebimentos" ADD CONSTRAINT "recebimentos_cobranca_id_cobrancas_id_fk" FOREIGN KEY ("cobranca_id") REFERENCES "public"."cobrancas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recebimentos" ADD CONSTRAINT "recebimentos_registrado_por_id_usuarios_id_fk" FOREIGN KEY ("registrado_por_id") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendas_material" ADD CONSTRAINT "vendas_material_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendas_material" ADD CONSTRAINT "vendas_material_material_id_materiais_id_fk" FOREIGN KEY ("material_id") REFERENCES "public"."materiais"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendas_material" ADD CONSTRAINT "vendas_material_registrado_por_id_usuarios_id_fk" FOREIGN KEY ("registrado_por_id") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;