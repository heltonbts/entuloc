CREATE TYPE "public"."base_multa" AS ENUM('percentual', 'valor_fixo');--> statement-breakpoint
CREATE TYPE "public"."cobranca_multa" AS ENUM('unica', 'por_dia');--> statement-breakpoint
CREATE TYPE "public"."contagem_prazo" AS ENUM('uteis', 'corridos');--> statement-breakpoint
CREATE TYPE "public"."papel" AS ENUM('gestor', 'funcionario');--> statement-breakpoint
CREATE TYPE "public"."status_cacamba" AS ENUM('disponivel', 'alugada', 'aguardando_retirada', 'manutencao', 'inativa');--> statement-breakpoint
CREATE TYPE "public"."status_locacao" AS ENUM('orcamento', 'agendada', 'entregue', 'retirada_solicitada', 'concluida', 'cancelada');--> statement-breakpoint
CREATE TYPE "public"."tipo_pessoa" AS ENUM('fisica', 'juridica');--> statement-breakpoint
CREATE TABLE "cacambas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"numeracao" text NOT NULL,
	"tipo_id" text NOT NULL,
	"status" "status_cacamba" DEFAULT 'disponivel' NOT NULL,
	"observacoes" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cacambas_numeracao_unique" UNIQUE("numeracao")
);
--> statement-breakpoint
CREATE TABLE "cidades" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" text NOT NULL,
	"uf" text NOT NULL,
	"valor_frete" integer NOT NULL,
	"ativa" boolean DEFAULT true NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cidades_nome_uf" UNIQUE("nome","uf"),
	CONSTRAINT "cidades_uf_valida" CHECK (char_length("cidades"."uf") = 2),
	CONSTRAINT "cidades_frete_nao_negativo" CHECK ("cidades"."valor_frete" >= 0)
);
--> statement-breakpoint
CREATE TABLE "clientes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" text NOT NULL,
	"tipo_pessoa" "tipo_pessoa" DEFAULT 'fisica' NOT NULL,
	"documento" text,
	"telefone" text,
	"email" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "clientes_documento_unique" UNIQUE("documento")
);
--> statement-breakpoint
CREATE TABLE "feriados" (
	"data" date PRIMARY KEY NOT NULL,
	"descricao" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "locacoes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cliente_id" uuid NOT NULL,
	"cacamba_id" uuid NOT NULL,
	"cidade_id" uuid NOT NULL,
	"endereco_entrega" text NOT NULL,
	"status" "status_locacao" DEFAULT 'orcamento' NOT NULL,
	"valor_locacao" integer NOT NULL,
	"valor_frete" integer NOT NULL,
	"dias_contratados" integer NOT NULL,
	"contagem_prazo" "contagem_prazo" NOT NULL,
	"regra_multa_id" uuid,
	"entrega_em" date,
	"vencimento_em" date,
	"retirada_solicitada_em" date,
	"retirada_em" date,
	"multa_apurada" integer,
	"criado_por_id" uuid,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "locacoes_valores_nao_negativos" CHECK ("locacoes"."valor_locacao" >= 0 AND "locacoes"."valor_frete" >= 0),
	CONSTRAINT "locacoes_dias_positivo" CHECK ("locacoes"."dias_contratados" >= 1),
	CONSTRAINT "locacoes_retirada_apos_entrega" CHECK ("locacoes"."retirada_em" IS NULL OR "locacoes"."entrega_em" IS NULL OR "locacoes"."retirada_em" >= "locacoes"."entrega_em")
);
--> statement-breakpoint
CREATE TABLE "regras_multa" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" text NOT NULL,
	"base" "base_multa" NOT NULL,
	"percentual_bps" integer,
	"valor_fixo" integer,
	"cobranca" "cobranca_multa" DEFAULT 'por_dia' NOT NULL,
	"dias_carencia" integer DEFAULT 0 NOT NULL,
	"teto_maximo" integer,
	"ativa" boolean DEFAULT true NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "regras_multa_base_coerente" CHECK (("regras_multa"."base" = 'percentual' AND "regras_multa"."percentual_bps" IS NOT NULL AND "regras_multa"."valor_fixo" IS NULL)
       OR ("regras_multa"."base" = 'valor_fixo' AND "regras_multa"."valor_fixo" IS NOT NULL AND "regras_multa"."percentual_bps" IS NULL)),
	CONSTRAINT "regras_multa_carencia_nao_negativa" CHECK ("regras_multa"."dias_carencia" >= 0)
);
--> statement-breakpoint
CREATE TABLE "tipos_cacamba" (
	"id" text PRIMARY KEY NOT NULL,
	"nome" text NOT NULL,
	"volume_m3" numeric(5, 2) NOT NULL,
	"valor_locacao" integer NOT NULL,
	"dias_inclusos" integer NOT NULL,
	"contagem_prazo" "contagem_prazo" DEFAULT 'uteis' NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tipos_cacamba_valor_nao_negativo" CHECK ("tipos_cacamba"."valor_locacao" >= 0),
	CONSTRAINT "tipos_cacamba_dias_positivo" CHECK ("tipos_cacamba"."dias_inclusos" >= 1)
);
--> statement-breakpoint
CREATE TABLE "usuarios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" text NOT NULL,
	"email" text NOT NULL,
	"papel" "papel" DEFAULT 'funcionario' NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "usuarios_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "cacambas" ADD CONSTRAINT "cacambas_tipo_id_tipos_cacamba_id_fk" FOREIGN KEY ("tipo_id") REFERENCES "public"."tipos_cacamba"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "locacoes" ADD CONSTRAINT "locacoes_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "locacoes" ADD CONSTRAINT "locacoes_cacamba_id_cacambas_id_fk" FOREIGN KEY ("cacamba_id") REFERENCES "public"."cacambas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "locacoes" ADD CONSTRAINT "locacoes_cidade_id_cidades_id_fk" FOREIGN KEY ("cidade_id") REFERENCES "public"."cidades"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "locacoes" ADD CONSTRAINT "locacoes_regra_multa_id_regras_multa_id_fk" FOREIGN KEY ("regra_multa_id") REFERENCES "public"."regras_multa"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "locacoes" ADD CONSTRAINT "locacoes_criado_por_id_usuarios_id_fk" FOREIGN KEY ("criado_por_id") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;