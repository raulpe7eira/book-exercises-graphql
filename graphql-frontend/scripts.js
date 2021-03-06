const listaAlunos = document.querySelector('#listaAlunos');

const GraphQl = {
    endpoint: 'https://eu1.prisma.sh/raul-pereira-29c5b0/graphql-prisma/dev',
    wsConnection: new WebSocket(
        'wss://eu1.prisma.sh/raul-pereira-29c5b0/graphql-prisma/dev',
        'graphql-subscriptions'
    ),
    exec: async function(query, variaveis) {
        const resposta = await fetch(GraphQl.endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: query, variables: variaveis }),
        });
        return await resposta.json();
    },
    iniciarWS: function() {
        return new Promise(resolve => {
            GraphQl.wsConnection.onopen = function() {
                const mensagem = { type: 'init' };
                GraphQl.wsConnection.send(JSON.stringify(mensagem));
                GraphQl.wsConnection.onmessage = function(event) {
                    const resposta = JSON.parse(event.data);
                    if (resposta.type === 'subscription_data') {
                        const aluno = resposta.payload.data.aluno;
                        if (aluno.mutation === 'CREATED') {
                            Template.inserirAlunoLista(aluno.node);
                        } else if (aluno.mutation === 'DELETED') {
                            const id = aluno.previousValues.id.replace(/StringIdGCValue\((.*)\)/, '$1');
                            Template.removerAlunoLista(id);
                        }
                    }
                }
                resolve();
            }
        })
    }
}

const Aluno = {
    lista: [],
    buscar: function() {
        const query = `
        query {
          alunoes {
            id
            nomeCompleto
            idade
          }
        }
        `;
        return GraphQl.exec(query);
    },
    criar: function(novoAluno) {
        const query = `
        mutation($nomeCompleto: String!, $idade: Int!) {
          createAluno(
            data: {
              nomeCompleto: $nomeCompleto
              idade: $idade
            }
          ) {
            id
            nomeCompleto
            idade
          }
        }
        `;
        return GraphQl.exec(query, novoAluno);
    },
    apagar: function(id) {
        const query = `
        mutation($id: ID!) {
          deleteAluno(
            where: {
              id: $id
            }
          ) {
            id
          }
        }
        `;
        return GraphQl.exec(query, { id });
    },
    subscription: function() {
        const query = `
        subscription updatedAlunos {
          aluno(
            where: {
              mutation_in: [CREATED, DELETED]
            }
          ) {
            mutation
            node {
              id
              nomeCompleto
              idade
            }
            previousValues {
              id
            }
          }
        }
        `;
        GraphQl.wsConnection.send(JSON.stringify({
            id: '1',
            type: 'subscription_start',
            query
        }))
    }
}

const Template = {
    iniciar: function() {
        Aluno.buscar()
            .then(({ data: { alunoes } }) => {
                Aluno.lista = alunoes;
                Template.listarAluno();
            })

        GraphQl.iniciarWS().then(Aluno.subscription);
    },
    listarAluno: function() {
        let html = ''
        Aluno.lista.forEach((aluno) => {
            html += `
            <li class="list-group-item">
                ${aluno.nomeCompleto} - <em>${aluno.idade} ano(s)</em>
                <button onclick="Template.apagarAluno('${aluno.id}')" class="btn btn-sm btn-danger float-right">
                    <i class="fa fa-trash"></i>
                </button>
            </li>
            `
        })
        listaAlunos.innerHTML = html;
    },
    criarAluno: function() {
        event.preventDefault();
        const formulario = document.forms.novoAluno,
            novoAluno = {
            nomeCompleto: formulario.nomeCompleto.value,
            idade: parseInt(formulario.idade.value)
        };
        if (novoAluno.nomeCompleto && novoAluno.idade) {
            formulario.nomeCompleto.value = '';
            formulario.idade.value = '';
            Aluno.criar(novoAluno);
        }
    },
    inserirAlunoLista: function(novoAluno) {
        Aluno.lista.push(novoAluno);
        Template.listarAluno();
    },
    apagarAluno: function(id) {
        Aluno.apagar(id);
    },
    removerAlunoLista: function(id) {
        const alunoIndice = Aluno.lista.findIndex(aluno => aluno.id === id);
        if (alunoIndice >= 0) {
            Aluno.lista.splice(alunoIndice, 1);
            Template.listarAluno();
        }
    }
}

Template.iniciar();
