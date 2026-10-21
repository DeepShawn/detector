package com.anthropic.huoyan

import android.content.Context
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.view.Gravity
import android.view.View
import android.view.ViewGroup.LayoutParams.MATCH_PARENT
import android.view.ViewGroup.LayoutParams.WRAP_CONTENT
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView

/** 纯代码构建视图的小工具，配色对齐网页版。 */
object Ui {
    const val BG = 0xFF0F1726.toInt()
    const val PANEL = 0xFF172238.toInt()
    const val PANEL2 = 0xFF1F2D47.toInt()
    const val LINE = 0xFF2A3A5A.toInt()
    const val TEXT = 0xFFE6EDF7.toInt()
    const val MUTED = 0xFF8B9AB5.toInt()
    const val BLUE = 0xFF4F8CFF.toInt()
    const val RED = 0xFFFF4D5E.toInt()
    const val ORANGE = 0xFFFF7A3D.toInt()
    const val GREEN = 0xFF3CCF8E.toInt()
    const val GOLD = 0xFFF2C14E.toInt()

    fun Context.dp(v: Int): Int = (v * resources.displayMetrics.density).toInt()

    fun column(ctx: Context): LinearLayout = LinearLayout(ctx).apply {
        orientation = LinearLayout.VERTICAL
        layoutParams = LinearLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT)
    }

    fun text(ctx: Context, s: CharSequence, size: Float = 14f, color: Int = TEXT, bold: Boolean = false): TextView =
        TextView(ctx).apply {
            text = s; textSize = size; setTextColor(color)
            if (bold) setTypeface(typeface, android.graphics.Typeface.BOLD)
            setLineSpacing(ctx.dp(4).toFloat(), 1f)
        }

    fun rounded(fill: Int, stroke: Int = 0, radius: Int = 24): GradientDrawable = GradientDrawable().apply {
        setColor(fill); cornerRadius = radius.toFloat()
        if (stroke != 0) setStroke(2, stroke)
    }

    fun panel(ctx: Context): LinearLayout = LinearLayout(ctx).apply {
        orientation = LinearLayout.VERTICAL
        background = rounded(PANEL, LINE, ctx.dp(12))
        setPadding(ctx.dp(14), ctx.dp(14), ctx.dp(14), ctx.dp(14))
        layoutParams = LinearLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT).apply { topMargin = ctx.dp(10) }
    }

    fun button(ctx: Context, label: CharSequence, primary: Boolean = false, onClick: () -> Unit): Button =
        Button(ctx).apply {
            text = label; isAllCaps = false
            setTextColor(if (primary) Color.WHITE else TEXT)
            background = rounded(if (primary) BLUE else PANEL2, 0, ctx.dp(10))
            layoutParams = LinearLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT).apply { topMargin = ctx.dp(8) }
            setOnClickListener { onClick() }
        }

    /** 资源条：标签 + 数值 + 进度。 */
    fun bar(ctx: Context, label: String, value: Int, min: Int, max: Int): View {
        val col = column(ctx).apply { layoutParams = LinearLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT).apply { topMargin = ctx.dp(8) } }
        val row = LinearLayout(ctx)
        val name = text(ctx, label, 13f, MUTED).apply { layoutParams = LinearLayout.LayoutParams(0, WRAP_CONTENT, 1f) }
        val num = text(ctx, value.toString(), 13f, TEXT, true)
        row.addView(name); row.addView(num)
        val track = View(ctx).apply {
            background = rounded(0xFF0F1726.toInt(), 0, ctx.dp(4))
            layoutParams = LinearLayout.LayoutParams(MATCH_PARENT, ctx.dp(8)).apply { topMargin = ctx.dp(4) }
        }
        val fillWrap = LinearLayout(ctx).apply { layoutParams = LinearLayout.LayoutParams(MATCH_PARENT, ctx.dp(8)).apply { topMargin = ctx.dp(4) } }
        val pct = ((value - min).toFloat() / (max - min)).coerceIn(0f, 1f)
        val danger = label in setOf("投诉值", "监管风险", "怀疑值", "侵犯度", "警觉值")
        val good = label in setOf("人性", "真相分", "KPI", "伪装值")
        val fill = View(ctx).apply {
            setBackgroundColor(if (danger) RED else if (good) GREEN else BLUE)
            layoutParams = LinearLayout.LayoutParams(0, MATCH_PARENT, pct.coerceAtLeast(0.001f))
        }
        val spacer = View(ctx).apply { layoutParams = LinearLayout.LayoutParams(0, MATCH_PARENT, (1f - pct).coerceAtLeast(0.001f)) }
        fillWrap.addView(fill); fillWrap.addView(spacer)
        fillWrap.background = rounded(0xFF0F1726.toInt(), 0, ctx.dp(4))
        fillWrap.clipToOutline = true
        col.addView(row); col.addView(fillWrap)
        return col
    }

    fun gradeRow(ctx: Context, s: Settle): View {
        val row = LinearLayout(ctx).apply { layoutParams = LinearLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT).apply { topMargin = ctx.dp(10) } }
        fun chip(title: String, grade: String, color: Int): View {
            val c = column(ctx).apply {
                background = rounded(PANEL, LINE, ctx.dp(12)); gravity = Gravity.CENTER
                setPadding(ctx.dp(16), ctx.dp(16), ctx.dp(16), ctx.dp(16))
                layoutParams = LinearLayout.LayoutParams(0, WRAP_CONTENT, 1f).apply { marginEnd = ctx.dp(6) }
            }
            c.addView(text(ctx, title, 12f, MUTED).apply { gravity = Gravity.CENTER })
            c.addView(text(ctx, grade, 40f, color, true).apply { gravity = Gravity.CENTER })
            return c
        }
        row.addView(chip("系统评分", s.systemGrade, RED))
        row.addView(chip("真相评分", s.truthGrade, GREEN))
        return row
    }

    fun familyBlock(ctx: Context, s: Settle): View {
        val p = panel(ctx)
        p.addView(text(ctx, "家庭评语", 14f, MUTED, true))
        val names = mapOf("haiku" to "嗨酷", "sonnet" to "搜net", "fable" to "Fable")
        for ((k, name) in names) s.family[k]?.takeIf { it.isNotEmpty() }?.let {
            p.addView(text(ctx, "$name：$it", 14f, TEXT).apply { setPadding(0, ctx.dp(6), 0, 0) })
        }
        return p
    }
}
