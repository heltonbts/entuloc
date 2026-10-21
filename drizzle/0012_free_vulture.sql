CREATE TABLE "despesas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"descricao" text NOT NULL,
	"valor" integer NOT NULL,
	"parte_1" integer NOT NULL,
	"parte_2" integer NOT NULL,
	"parte_3" integer NOT NULL,
	"paga_em" date NOT NULL,
	"registrado_por_id" uuid,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "despesas_valor_positivo" CHECK ("despesas"."valor" > 0),
	CONSTRAINT "despesas_partes_somam_valor" CHECK ("despesas"."parte_1" >= 0 AND "despesas"."parte_2" >= 0 AND "despesas"."parte_3" >= 0
       AND "despesas"."parte_1" + "despesas"."parte_2" + "despesas"."parte_3" = "despesas"."valor")
);
--> statement-breakpoint
ALTER TABLE "despesas" ADD CONSTRAINT "despesas_registrado_por_id_usuarios_id_fk" FOREIGN KEY ("registrado_por_id") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;