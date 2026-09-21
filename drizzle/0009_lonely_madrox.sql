CREATE TYPE "public"."forma_cobranca" AS ENUM('entrega', 'retirada', 'periodo');--> statement-breakpoint
CREATE TYPE "public"."periodo_fatura" AS ENUM('semanal', 'quinzenal', 'mensal');--> statement-breakpoint
ALTER TYPE "public"."origem_cobranca" ADD VALUE 'fatura';--> statement-breakpoint
CREATE TABLE "itens_fatura" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cobranca_id" uuid NOT NULL,
	"locacao_id" uuid NOT NULL,
	"valor" integer NOT NULL,
	CONSTRAINT "itens_fatura_locacao_id_unique" UNIQUE("locacao_id"),
	CONSTRAINT "itens_fatura_valor_positivo" CHECK ("itens_fatura"."valor" > 0)
);
--> statement-breakpoint
ALTER TABLE "cobrancas" DROP CONSTRAINT "cobrancas_origem_coerente";--> statement-breakpoint
ALTER TABLE "clientes" ADD COLUMN "forma_cobranca" "forma_cobranca" DEFAULT 'retirada' NOT NULL;--> statement-breakpoint
ALTER TABLE "clientes" ADD COLUMN "periodo_fatura" "periodo_fatura";--> statement-breakpoint
ALTER TABLE "clientes" ADD COLUMN "prazo_pagamento_dias" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "vendas_material" ADD COLUMN "locacao_id" uuid;--> statement-breakpoint
ALTER TABLE "itens_fatura" ADD CONSTRAINT "itens_fatura_cobranca_id_cobrancas_id_fk" FOREIGN KEY ("cobranca_id") REFERENCES "public"."cobrancas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "itens_fatura" ADD CONSTRAINT "itens_fatura_locacao_id_locacoes_id_fk" FOREIGN KEY ("locacao_id") REFERENCES "public"."locacoes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendas_material" ADD CONSTRAINT "vendas_material_locacao_id_locacoes_id_fk" FOREIGN KEY ("locacao_id") REFERENCES "public"."locacoes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendas_material" ADD CONSTRAINT "vendas_material_locacao_id_unique" UNIQUE("locacao_id");--> statement-breakpoint
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_periodo_coerente" CHECK (("clientes"."forma_cobranca" = 'periodo') = ("clientes"."periodo_fatura" IS NOT NULL));--> statement-breakpoint
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_prazo_nao_negativo" CHECK ("clientes"."prazo_pagamento_dias" >= 0);--> statement-breakpoint
ALTER TABLE "cobrancas" ADD CONSTRAINT "cobrancas_origem_coerente" CHECK (("cobrancas"."origem"::text = 'locacao' AND "cobrancas"."locacao_id" IS NOT NULL AND "cobrancas"."venda_id" IS NULL)
       OR ("cobrancas"."origem"::text = 'venda_material' AND "cobrancas"."venda_id" IS NOT NULL AND "cobrancas"."locacao_id" IS NULL)
       OR ("cobrancas"."origem"::text = 'fatura' AND "cobrancas"."locacao_id" IS NULL AND "cobrancas"."venda_id" IS NULL));