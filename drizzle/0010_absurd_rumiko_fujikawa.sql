CREATE TYPE "public"."tipo_movimento" AS ENUM('entrada_entulho', 'producao', 'consumo_entulho', 'ajuste');--> statement-breakpoint
CREATE TABLE "movimentos_estoque" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tipo" "tipo_movimento" NOT NULL,
	"material_id" uuid,
	"quantidade" numeric(12, 3) NOT NULL,
	"locacao_id" uuid,
	"lote_id" uuid,
	"observacao" text,
	"ocorrido_em" date NOT NULL,
	"registrado_por_id" uuid,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "movimentos_estoque_locacao_id_unique" UNIQUE("locacao_id"),
	CONSTRAINT "movimentos_quantidade_nao_zero" CHECK ("movimentos_estoque"."quantidade" <> 0),
	CONSTRAINT "movimentos_tipo_coerente" CHECK (("movimentos_estoque"."tipo" IN ('entrada_entulho', 'consumo_entulho') AND "movimentos_estoque"."material_id" IS NULL)
       OR ("movimentos_estoque"."tipo" = 'producao' AND "movimentos_estoque"."material_id" IS NOT NULL)
       OR "movimentos_estoque"."tipo" = 'ajuste'),
	CONSTRAINT "movimentos_sinal_coerente" CHECK (("movimentos_estoque"."tipo" IN ('entrada_entulho', 'producao') AND "movimentos_estoque"."quantidade" > 0)
       OR ("movimentos_estoque"."tipo" = 'consumo_entulho' AND "movimentos_estoque"."quantidade" < 0)
       OR "movimentos_estoque"."tipo" = 'ajuste')
);
--> statement-breakpoint
ALTER TABLE "movimentos_estoque" ADD CONSTRAINT "movimentos_estoque_material_id_materiais_id_fk" FOREIGN KEY ("material_id") REFERENCES "public"."materiais"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimentos_estoque" ADD CONSTRAINT "movimentos_estoque_locacao_id_locacoes_id_fk" FOREIGN KEY ("locacao_id") REFERENCES "public"."locacoes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimentos_estoque" ADD CONSTRAINT "movimentos_estoque_registrado_por_id_usuarios_id_fk" FOREIGN KEY ("registrado_por_id") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;