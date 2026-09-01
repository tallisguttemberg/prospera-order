(function (root) {
  'use strict';

  const { jsPDF } = root.jspdf;

  function fmtMoedaBRL(centavos) {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format((centavos || 0) / 100);
  }

  function fmtDataBR(iso) {
    if (!iso) return '';
    const [a, m, d] = iso.split('-');
    return `${d}/${m}/${a}`;
  }

  function fmtTelefone(raw) {
    const d = String(raw || '').replace(/\D/g, '');
    if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
    if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
    return raw || '';
  }

  function vendaCliente(cliente, vendas, produtos, config) {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const LARGURA = doc.internal.pageSize.getWidth();
    const MARGEM = 15;
    const LARG_UTIL = LARGURA - MARGEM * 2;
    const LOGO_DIM = 30;
    const LOGO_X = LARGURA - MARGEM - LOGO_DIM;
    const LOGO_Y = MARGEM;
    const TXT_MAX = LOGO_X - MARGEM - 5;
    let y = MARGEM;

    if (root.LOGO_B64) {
      doc.addImage(root.LOGO_B64, 'JPEG', LOGO_X, LOGO_Y, LOGO_DIM, LOGO_DIM);
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);

    if (config.vendedorNome) {
      doc.text(String(config.vendedorNome), MARGEM, y, { maxWidth: TXT_MAX });
      y += 5;
    }
    if (config.empresaNome) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text(String(config.empresaNome), MARGEM, y, { maxWidth: TXT_MAX });
      y += 4;
    }
    if (config.empresaContato) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text('Contato: ' + fmtTelefone(config.empresaContato), MARGEM, y, { maxWidth: TXT_MAX });
      y += 6;
    }

    doc.setDrawColor(180);
    doc.setLineWidth(0.3);
    doc.line(MARGEM, y, LARGURA - MARGEM, y);
    y += 6;

    if (root.LOGO_B64 && LOGO_Y + LOGO_DIM > y) {
      y = LOGO_Y + LOGO_DIM;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('Dados do Cliente', MARGEM, y);
    y += 6;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);

    doc.text(cliente.nome || '', MARGEM, y);
    y += 4;

    if (cliente.telefone) {
      doc.text('Tel: ' + fmtTelefone(cliente.telefone), MARGEM, y);
      y += 4;
    }

    const endPartes = [cliente.endereco, cliente.bairro, cliente.cidade && cliente.estado ? cliente.cidade + ' - ' + cliente.estado : cliente.cidade || cliente.estado].filter(Boolean);
    if (endPartes.length) {
      doc.text(endPartes.join(' — '), MARGEM, y);
      y += 6;
    }

    doc.line(MARGEM, y, LARGURA - MARGEM, y);
    y += 6;

    const dataVenda = vendas[0] ? fmtDataBR(new Date(vendas[0].criadoEm).toISOString().slice(0, 10)) : '';
    if (dataVenda) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text('Data: ' + dataVenda, MARGEM, y);
      y += 6;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    const colQtd = MARGEM;
    const colProd = MARGEM + 15;
    const colUnit = MARGEM + 110;
    const colTotal = MARGEM + 145;

    doc.setFillColor(240, 240, 240);
    doc.rect(MARGEM, y - 4, LARG_UTIL, 6, 'F');
    doc.text('Qtd', colQtd + 1, y);
    doc.text('Produto', colProd + 1, y);
    doc.text('V.Unit.', colUnit + 1, y);
    doc.text('Total', colTotal + 1, y);
    y += 6;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);

    let totalGeral = 0;
    const prodMap = new Map(produtos.map((p) => [p.id, p]));

    for (const v of vendas) {
      const nome = (prodMap.get(v.produtoId) || {}).nome || 'Produto removido';
      const sub = v.unidades * v.valorUnitCentavos;
      totalGeral += sub;

      doc.text(String(v.unidades), colQtd + 1, y);
      doc.text(String(nome), colProd + 1, y);
      doc.text(fmtMoedaBRL(v.valorUnitCentavos), colUnit + 1, y);
      doc.text(fmtMoedaBRL(sub), colTotal + 1, y);
      y += 5;

      if (y > 270) {
        doc.addPage();
        y = MARGEM;
      }
    }

    y += 2;
    doc.setDrawColor(180);
    doc.line(MARGEM, y, LARGURA - MARGEM, y);
    y += 6;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('TOTAL:', colTotal - 30, y);
    doc.text(fmtMoedaBRL(totalGeral), colTotal + 1, y);

    return doc;
  }

  function compartilharPdf(doc, nomeArquivo) {
    const blob = doc.output('blob');
    const arquivo = new File([blob], nomeArquivo, { type: 'application/pdf' });

    if (navigator.share && navigator.canShare && navigator.canShare({ files: [arquivo] })) {
      return navigator.share({
        title: nomeArquivo,
        files: [arquivo],
      });
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nomeArquivo;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  root.PdfExport = { vendaCliente, compartilharPdf };
})(self);
