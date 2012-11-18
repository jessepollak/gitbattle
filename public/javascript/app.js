

var stats = ['age', 'stars', 'forks', 'commits', 'repositories', 'gists', 'followers'],
 users = [];
$(document).ready(function() {
    var params = getUrlParams();
    var u1 = params.u1;
    var u2 = params.u2;

    if(u1) $('.user1 input').val(u1);
    if(u2) $('.user2 input').val(u2);

    $('#submit').click(visualize);

    $('.user2 input, .user1 input').focus(function() {
        $(this).val('').unbind('focus');
    })
    $('.user2 input, .user1 input').keypress(handleEnter);

    $('.retry-container').click(reset);
});

function handleEnter(e) {
    var code = e.keyCode || e.which;
    if (code == 13) {
        e.preventDefault();
        visualize();
    }
}

function visualize(e) {
    var scraper = new Scraper();
    var $this = $(this);
    var $graphsContainer = $('.graphs-container');
    var form = document.forms[0],
        promises = [],
        valid = true;

    var fail = false;
    var storage = typeof(Storage)!=="undefined";

    users.push($(form['user_1']).val());
    users.push($(form['user_2']).val());
    for(var i = 0; i < users.length; i++) {
        if(users[i] == "") {
            $(form['user_' + (i + 1)]).css('border', '5px solid rgb(186, 0,0)');
            valid = false;
            $('#submit').text('INVALID');
        } else {
            promises.push($.Deferred(function(def) {
                var key = i + 1;
                $.ajax({
                    url: GITHUB + 'users/' + users[i] + IDENTITY + '&callback=?',
                    success: function(data) {
                        if (data.data && data.data.message == "Not Found") {
                            $(form['user_' + key]).css('border', '5px solid rgb(186, 0,0)');
                            fail = true;
                        } else {
                            // #6 - Use the login for all future requests
                            users[key-1] = data.data.login;
                        }
                        def.resolve();
                    },
                    dataType: 'jsonp'
                });
            }));  
        }
    }

    if(!valid) {
        users = [];
        return false;
    }

    $.when.apply(null, promises).done(function () {
        if(fail) {
            users = [];
            $('#submit').text('INVALID');
            return false;
        } else {
            $('input').css('border', 'none');
            promises = [];
            $('#submit').unbind('click');
            $('.user2 input, .user1 input').unbind('keypress');
            $this.css('cursor', 'default');

            var loadingInterval = loadingMessage();
            for(var i = 0; i < users.length; i++) {
                promises.push(
                    $.Deferred(
                        function(def) {
                            scraper.getUserData(users[i], $('.processing-container'), def);
                        }
                    )
                );
            };

            


            $.when.apply(null, promises).done(function(u1, u2) {
                if (typeof Storage !== 'undefined') {
                    u1.processed = new Date();
                    u2.processed = new Date();
                    localStorage.setItem(users[0], JSON.stringify(u1));
                    localStorage.setItem(users[1], JSON.stringify(u2));
                }
                setupGraphs(u1, u2, loadingInterval, users);
            });
        }
    });
    
}

function setupGraphs(u1, u2, interval, users) {
    var saver = {},
        totals = {
            u1: 0,
            u2: 0
        },
        $form = $(document.forms[0]),
        graphs = [];

    stats.forEach(function (s) {
        var g = setupGraph(u1, u2, s, saver, totals);
        graphs.push(g.hide());
    });
    
    setupWinner(u1, u2);
    displayGraphs($form, graphs, interval, users);
}

function setupGraph(u1, u2, name, saver, totals) {
    var graph = graphTemplate.clone();
    var r = dataFormatter(u1, u2, name, totals);
    saver[name] = r;
    r = normalize(r, name);
    graph.find('.label').text(formattedNames[name]);
    graph.find('.graph_1 h3').text(r.user1.actual);
    graph.find('.graph_2 h3').text(r.user2.actual);
    graph.find('.graph_1').css('width', r.user1.percent + '%');
    graph.find('.graph_2').css('width', r.user2.percent + '%');
    return graph;
}

function displayGraphs(form, graphs, interval, users) {
    clearInterval(interval);
    $(form).slideUp(500);
    $('.processing-container').hide();
    var $graphsContainer = $('.graphs-container')
    $graphsContainer.show();
    countUp($('.result_1 h2'));
    countUp($('.result_2 h2'));
    $('.winner-container').slideDown(2000, function() {
        graphs.forEach(function(g) {
            $graphsContainer.append(g);
            g.slideDown(1000);
        });
        $('.retry-container').slideDown();
        var link = "http://gitbattle.com?u1=" + users[0] + "&u2=" + users[1];
        $('.share-container h5 a').text(link).attr('href', link);
        $('.share-container').show();
    });
}

function countUp(el) {
    var id = setInterval(numberCounter, 50);
    var time = 0;
    var number = parseFloat(el.data('total'));
    function numberCounter() {
        position = time / 1500;
            if (time == 1500) {
                clearInterval(id);
            }
        el.text((position * number).toFixed(2));
        time += 50;
    }
}

function setupWinner(u1, u2) {
    var u1Score = finalScore(u1),
        u2Score = finalScore(u2);
    $('.result_1 h3').text(users[0]);
    $('.result_2 h3').text(users[1]);
    $('.result_1 h2').text(0);
    $('.result_2 h2').text(0);
    $('.result_1 h2').data('total', u1Score);
    $('.result_2 h2').data('total', u2Score);
    var twitter;
    if(parseFloat(u1Score) > parseFloat(u2Score)) {
        $('.result_2 h3, .result_2 h2').addClass('loser');
        $('.result_1 h3, .result_1 h2').addClass('winner');
        twitter = twitterTemplate(users[0], users[1], u1Score, u2Score);
    } else {
        $('.result_1 h3, .result_1 h2').addClass('loser');
        $('.result_2 h3, .result_2 h2').addClass('winner');
        twitter = twitterTemplate(users[1], users[0], u2Score, u1Score);
    }
    if(typeof twttr !== 'undefined') {
        $('.retry-container').prepend(twitter);
        twttr.widgets.load();
    }
}

var graphTemplate = $("<div class='graph-container'> \
                        <div class='twelve columns'> \
                            <h3 class='label'>Commits</h3> \
                        </div> \
                        <div class='twelve columns'> \
                            <div class='graph_1 graph'><h3>63</h3></div> \
                            <div class='graph_2 graph'><h3>20</h3></div> \
                        </div> \
                    </div>");

function twitterTemplate(w, l, wScore, lScore)  {
    return $("<div class='twitter'> \
                            <a href='https://twitter.com/share' \
                             data-text='" + w +" just beat " + l + " on GitBattle " + 
                             wScore + " to " + lScore + ". Battle now to see if you can beat either of them:'\
                             class='twitter-share-button' data-counturl='gitbattle.com' data-lang='en' data-url='http://www.gitbattle.com?u1=" + w + "&u2=" + l + "' data-size='medium' data-count='vertical'>Tweet</a> \
                        <h5>about your victory (or loss)</h5> \
                        </div>");
} 


var formattedNames = {
    'age': 'Age (days)',
    'forks': 'Forks/repo',
    'stars': 'Stars/repo',
    'commits': 'Commits/day',
    'repositories': 'Repos',
    'gists': 'Gists',
    'followers': 'Followers'
}

function reset() {
    $('.graphs-container').empty().hide();
    $('.retry-container').hide();
    $('#submit').text('BATTLE');
    $('#submit').click(visualize);
    $('.user2 input, .user1 input').keypress(handleEnter);
    $('.user1 input').val('');
    $('.user2 input').val('');
    $(document.forms[0]).show();
    $('.winner-container').hide();
    $('.retry-container .twitter').remove();
    $('.processing-container columns').empty();

    $('.result_1 h3, .result_1 h2').removeClass('loser');
    $('.result_2 h3, .result_2 h2').removeClass('winner');
    $('.result_1 h3, .result_1 h2').removeClass('winner');
    $('.result_2 h3, .result_2 h2').removeClass('loser');
    users = [];
}

function normalize(r, name) {
    if(r.user1.percent < 10) {
        r.user1.percent = 15;
        r.user2.percent = 84;
    } else if (r.user2.percent < 10) {
        r.user2.percent = 15;
        r.user1.percent = 84;
    } else if (r.user2.percent + r.user1.percent === 100) {
        r.user1.percent -= 1;
    }
    if(name == 'commits' || name == 'stars' || name == 'forks') {
        if(r.user1.actual == 0) r.user1.actual = '~0';
        if(r.user2.actual == 0) r.user2.actual = '~0';
    }
    if(name === 'gists') {
        if(r.user1.actual > 100) r.user1.actual = '100+';
        if(r.user2.actual > 100) r.user2.actual = '100+';
    }
    return r;
}

function dataFormatter(user1, user2, stat) {
    if(stat == 'age') {
        var init_date_1 = Date.parse(user1.age),
            init_date_2 = Date.parse(user2.age),
            today = Date.parse(new Date());
        var diff1 = Math.floor(((today - init_date_1) / 86400000)),
            diff2 = Math.floor(((today - init_date_2) / 86400000));
        var dp1 = Math.floor(diff1 / (diff1 + diff2) * 100),
            dp2 = Math.floor(diff2 / (diff1 + diff2) * 100);

        return {
            user1: {
                "actual" : diff1,
                "percent" : dp1
            },
            user2: {
                "actual" : diff2,
                "percent": dp2
            }
        }
    } else if (stat == 'forks' || stat == 'stars') {
        if(user1.repositories !== 0) {
            var ratio1 = Math.round((user1[stat] / user1.repositories * 10)) / 10;
        } else {
            var ratio1 = 0;
        }
        if(user2.repositories !== 0) {
            var ratio2 = Math.round((user2[stat] / user2.repositories * 10)) / 10;
        } else {
            var ratio2 = 0;
        }

        if(ratio1 + ratio2 == 0) {
            var dp1 = 50,
                dp2 = 50;
        } else {
            var dp1 = Math.floor((ratio1 / (ratio1 + ratio2)) * 100),
                dp2 = Math.floor((ratio2 / (ratio1 + ratio2)) * 100);   
        }

        return {
            user1: {
                "actual" : ratio1,
                "percent" : dp1
            },
            user2: {
                "actual" : ratio2,
                "percent": dp2
            }
        }; 
    } else if (stat == 'commits') {
            var init_date_1 = Date.parse(user1.age),
            init_date_2 = Date.parse(user2.age),
            today = Date.parse(new Date());
            var diff1 = Math.floor(((today - init_date_1) / 86400000)),
                diff2 = Math.floor(((today - init_date_2) / 86400000)); 
            if (diff1 !== 0 && user1.commits !== 0) {
                var ratio1 = Math.floor((user1.commits / diff1 * 10)) / 10;
            } else {
                var ratio1 = 0;
            }

            if (diff2 !== 0 && user2.commits !== 0) {
                var ratio2 = Math.floor((user2.commits / diff2 * 10)) / 10;
            } else {
                var ratio2 = 0;
            }

            if (ratio1 + ratio2 === 0) {
                var dp1 = 50,
                    dp2 = 50;
            } else {
                var dp1 = Math.floor((ratio1 / (ratio1 + ratio2)) * 100),
                    dp2 = Math.floor((ratio2 / (ratio1 + ratio2)) * 100);   
            }

            return {
                user1: {
                    "actual" : ratio1,
                    "percent" : dp1
                },
                user2: {
                    "actual" : ratio2,
                    "percent": dp2
                }
            };
    } else if (stat === 'gists' || stat === 'repositories' || stat === 'followers') {
        var total = (user1[stat] + user2[stat]);
        if (total === 0) {
            var dp1 = 50, 
                dp2 = 50;
        } else {
            var dp1 = Math.floor(user1[stat] / total * 100);
            var dp2 = Math.floor(user2[stat] / total * 100);
        }

        return {
            user1: {
                'actual': user1[stat],
                'percent': dp1
            },
            user2: {
                'actual': user2[stat],
                'percent': dp2
            }
        }
    }
}

function loadingMessage() {
    var $fight = $('#submit'),
        count = 0;
    $fight.html("<span>Processing...</span><div>(this will take awhile if you are a badass)</div>");
    $fight.fadeTo(1000, 0).fadeTo(1000, 1);
    var interval = setInterval(function() {
        count++;
        $fight.fadeTo(1000, 0).fadeTo(1000, 1);
        if(count === 5) {
            $fight.html("<span>Processing...</span><div>(you're thinking you're real cool right now.)</div>");
        } else if(count == 10) {
            $fight.html("<span>Processing...</span><div>(alright, not bad)</div>");
        } else if(count == 20) {
            $fight.html("<span>Processing...</span><div>(OK, you're a badass.)</div>");
        } else if(count === 30) {
            $fight.html("<span>Processing...</span><div>(No one else has made it this far...)</div>");
        } else if(count === 45) {
            $fight.html("<span>Processing...</span><div>(You've unlocked the secret of life!)</div>");
        }
    }, 2000);
    return interval;
}

function finalScore(user) {
    var time = user.age, 
        repos = user.repositories, 
        commits = user.commits, 
        forks = user.forks, 
        stars = user.stars, 
        gists = user.gists;
    // all times in seconds
    var github_founding_time = 1206835200
        user_init_time = (Date.parse(time) / 1000),
        now_time = (Date.parse(new Date()) / 1000),
        diff_time = now_time - user_init_time;

    /*
    * Perfect scores are in ()
    */


    // find age score (in percentage of time on github since the beginning) (1, since very first day)
    if (now_time - github_founding_time != 0) {
        var raw_score_age = (now_time - user_init_time) / (now_time - github_founding_time);
    } else {
        // something weird just happened set to 0
        var raw_score_age = 0;
    }

    // find raw gist score (100)
    var raw_score_gist = Math.sqrt(gists) / 10;
    if (raw_score_gist > 1) {
        raw_score_gist = 1;
    }

    // find raw repo score (100)
    var raw_score_repo = Math.sqrt(repos) / 10;
    if (raw_score_repo > 1) {
        raw_score_repo = 1;
    }

    // find raw commits per day score (36)
    if (diff_time > 0) {
        var raw_score_cpd = Math.sqrt((commits / (diff_time / 86400))) / 5.75;
        if (raw_score_cpd > 1) {
            raw_score_cpd = 1;
        }
    } else {
        var raw_score_cpd = 0;
    }

    // find raw forks per repo (225)
    if (repos > 0) {
        var raw_score_fpr = Math.sqrt(forks / repos) / 15;
        if(raw_score_fpr > 1) {
            raw_score_fpr = 1;
        }
    } else {
        var raw_score_fpr = 0;
    }

    // find raw stars per repo (1024)
    if (repos > 0) {
        var raw_score_spr = Math.sqrt(stars / repos) / 31;
        if(raw_score_spr > 1) {
            raw_score_spr = 1;
        }
    } else {
        var raw_score_spr = 0;
    }

    // add weights
    var final_score = ((raw_score_age * 0.1) + (raw_score_gist * 0.05) + (raw_score_repo * 0.1) + (raw_score_cpd * 0.45) + (raw_score_fpr * 0.15) + (raw_score_spr * 0.15)) * 100;

    return final_score.toFixed(2);
}

function getUrlParams() {
  var params = {};
  window.location.search.replace(/[?&]+([^=&]+)=([^&]*)/gi, function(str,key,value) {
    params[key] = value;
  });
 
  return params;
}


